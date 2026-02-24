# Part of OpenG2P. See LICENSE file for full copyright and licensing details.
import logging
import psycopg2
from odoo import api, models, fields

_logger = logging.getLogger(__name__)

class PBMSDashboardLogic(models.Model):
    _name = "g2p.pbms.dashboard.logic"
    _description = "PBMS Dashboard Logic"

    def _get_bg_task_db_conn(self):
        """Establish connection to the BG Task Database"""
        get_param = self.env['ir.config_parameter'].sudo().get_param
        try:
            conn = psycopg2.connect(
                host=get_param('g2p_pbms_dashboard.bg_task_db_host', 'localhost'),
                port=get_param('g2p_pbms_dashboard.bg_task_db_port', '5432'),
                user=get_param('g2p_pbms_dashboard.bg_task_db_user', 'postgres'),
                password=get_param('g2p_pbms_dashboard.bg_task_db_password', ''),
                dbname=get_param('g2p_pbms_dashboard.bg_task_db_name', 'bgtaskdb'),
                connect_timeout=5
            )
            return conn
        except Exception as e:
            _logger.error("Failed to connect to BG Task DB: %s", str(e))
            return None

    @api.model
    def get_dashboard_data(self, filters=None):
        filters = filters or {}
        bg_conn = self._get_bg_task_db_conn()
        
        result = {
            'kpi': {
                'total_enrolled': 0,
                'total_disbursed_amount': 0,
                'total_budget_allocated': 0,
                'program_count': 0
            },
            'charts': {'age': {}, 'gender': {}, 'region_data': {}},
            'map_data': {},
            'programs': []
        }

        # 1. Fetch Programs from Odoo DB
        programs = self.env['g2p.program.definition'].search_read(
            [], ['id', 'program_mnemonic'], order='program_mnemonic'
        )
        result['programs'] = [{"id": p['id'], "name": p['program_mnemonic']} for p in programs]
        result['kpi']['program_count'] = len(programs)

        if not bg_conn:
            return result

        try:
            bg_cr = bg_conn.cursor()
            
            # 2. Identify Enrolled IDs (Unique Beneficiaries in Approved Enrollment Lists)
            # -------------------------------------------------------------------------
            odoo_list_domain = [
                ('list_stage', '=', 'enrollment'),
                ('list_workflow_status', '=', 'approved_final_enrolment')
            ]
            if filters.get('program_id'):
                odoo_list_domain.append(('program_id', '=', int(filters['program_id'])))
            
            enrollment_lists = self.env['g2p.beneficiary.list'].search(odoo_list_domain)
            enrollment_uuids = enrollment_lists.mapped('beneficiary_list_id')

            enrolled_ids = []
            if enrollment_uuids:
                query_enrolled = f"""
                    SELECT DISTINCT jsonb_array_elements(registrant_details::jsonb)->>'registrant_id'
                    FROM beneficiary_list_details
                    WHERE beneficiary_list_id IN ({','.join(['%s']*len(enrollment_uuids))})
                """
                bg_cr.execute(query_enrolled, tuple(enrollment_uuids))
                enrolled_ids = [r[0] for r in bg_cr.fetchall()]
            
            result['kpi']['total_enrolled'] = len(enrolled_ids)

            # 3. Calculate Disbursed and Allocated Amounts from BG Task DB
            # -----------------------------------------------------------
            # Disbursement Batch contains individual entitlements grouped by envelope/batch
            
            # Filter disbursement batches by the selected program's disbursement lists
            disb_list_filter = ""
            disb_params = []
            if filters.get('program_id'):
                disb_lists = self.env['g2p.beneficiary.list'].search([
                    ('program_id', '=', int(filters['program_id'])),
                    ('list_stage', '=', 'disbursement')
                ])
                disb_uuids = disb_lists.mapped('beneficiary_list_id')
                if disb_uuids:
                    disb_list_filter = f"AND beneficiary_list_id IN ({','.join(['%s']*len(disb_uuids))})"
                    disb_params = list(disb_uuids)
                else:
                    disb_list_filter = "AND 1=0" # Force no results

            # Sum total disbursed (completed batches)
            bg_cr.execute(f"SELECT SUM(total_disbursement_quantity) FROM disbursement_batch WHERE disbursement_status = 'complete' {disb_list_filter}", disb_params)
            result['kpi']['total_disbursed_amount'] = float(bg_cr.fetchone()[0] or 0)

            # Total Budget Allocated (All disbursement records, even if not yet complete)
            bg_cr.execute(f"SELECT SUM(total_disbursement_quantity) FROM disbursement_batch WHERE 1=1 {disb_list_filter}", disb_params)
            result['kpi']['total_budget_allocated'] = float(bg_cr.fetchone()[0] or 0)

            # 4. Fetch Demographics from Odoo for Enrolled IDs
            # -----------------------------------------------
            if enrolled_ids:
                # Odoo ID mapping might be internal_record_id or just ID. 
                # Assuming ID mapping for simplicity, but search_read handles both if using proper domain.
                
                # We use a raw SQL query on Odoo side for demographic aggregations for speed
                enrolled_ids_sql = tuple(enrolled_ids) if len(enrolled_ids) > 1 else f"('{enrolled_ids[0]}')"
                
                # Filter by demographics if provided in frontend
                dem_where = "id IN %s"
                dem_params = [tuple(enrolled_ids)]
                
                # Gender Distribution
                q_gender = f"SELECT gender, COUNT(*) FROM res_partner WHERE {dem_where} GROUP BY gender"
                self.env.cr.execute(q_gender, dem_params)
                gen_res = dict(self.env.cr.fetchall())
                result['charts']['gender'] = {
                    'Male': gen_res.get('male', 0),
                    'Female': gen_res.get('female', 0),
                    'Other': gen_res.get('other', 0)
                }

                # Age Distribution (Buckets)
                q_age = f"""
                    SELECT 
                        CASE 
                            WHEN age_val < 18 THEN 'Under 18'
                            WHEN age_val BETWEEN 18 AND 69 THEN '18-69'
                            WHEN age_val BETWEEN 70 AND 75 THEN '70-75'
                            WHEN age_val BETWEEN 76 AND 80 THEN '76-80'
                            WHEN age_val BETWEEN 81 AND 85 THEN '81-85'
                            WHEN age_val BETWEEN 86 AND 90 THEN '86-90'
                            WHEN age_val BETWEEN 91 AND 95 THEN '91-95'
                            WHEN age_val BETWEEN 96 AND 100 THEN '96-100'
                            WHEN age_val > 100 THEN '101+'
                            ELSE 'Unknown'
                        END as bucket,
                        COUNT(*)
                    FROM (
                        SELECT EXTRACT(YEAR FROM age(current_date, birthdate)) as age_val 
                        FROM res_partner 
                        WHERE {dem_where} AND birthdate IS NOT NULL
                    ) sub GROUP BY bucket
                """
                self.env.cr.execute(q_age, dem_params)
                result['charts']['age'] = dict(self.env.cr.fetchall())

                # Regional/District Distribution (using Odoo Registry state/district)
                # Check for administrative fields on res.partner
                fields_available = self.env['res.partner']._fields.keys()
                
                if 'state_id' in fields_available:
                    q_region = f"""
                        SELECT s.name, COUNT(p.id)
                        FROM res_partner p
                        JOIN res_country_state s ON p.state_id = s.id
                        WHERE p.{dem_where}
                        GROUP BY s.name
                    """
                    self.env.cr.execute(q_region, dem_params)
                    region_counts = dict(self.env.cr.fetchall())
                    
                    result['charts']['region_data'] = {
                        'labels': list(region_counts.keys()),
                        'datasets': [{
                            'label': 'Enrolled',
                            'data': list(region_counts.values()),
                            'backgroundColor': '#3b82f6',
                        }]
                    }
                    # For Map Component
                    result['map_data'] = region_counts

                # If district exists, we could further drill down
                # For now, we populate map_data with the finest level available (Region or District)

            return result

        except Exception as e:
            _logger.exception("Error during dual-DB dashboard data fetch: %s", str(e))
            return result
        finally:
            if bg_conn:
                bg_conn.close()
