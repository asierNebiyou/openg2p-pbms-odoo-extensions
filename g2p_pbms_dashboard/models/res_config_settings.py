from odoo import fields, models

class ResConfigSettings(models.TransientModel):
    _inherit = "res.config.settings"

    bg_task_db_host = fields.Char(string="BG Task DB Host", config_parameter="g2p_pbms_dashboard.bg_task_db_host", default="localhost")
    bg_task_db_port = fields.Char(string="BG Task DB Port", config_parameter="g2p_pbms_dashboard.bg_task_db_port", default="5432")
    bg_task_db_user = fields.Char(string="BG Task DB User", config_parameter="g2p_pbms_dashboard.bg_task_db_user", default="postgres")
    bg_task_db_password = fields.Char(string="BG Task DB Password", config_parameter="g2p_pbms_dashboard.bg_task_db_password")
    bg_task_db_name = fields.Char(string="BG Task DB Name", config_parameter="g2p_pbms_dashboard.bg_task_db_name", default="bgtaskdb")

    sr_db_host = fields.Char(string="SR DB Host", config_parameter="g2p_pbms_dashboard.sr_db_host", default="socialregistry-postgresql")
    sr_db_port = fields.Char(string="SR DB Port", config_parameter="g2p_pbms_dashboard.sr_db_port", default="5432")
    sr_db_user = fields.Char(string="SR DB User", config_parameter="g2p_pbms_dashboard.sr_db_user", default="postgres")
    sr_db_password = fields.Char(string="SR DB Password", config_parameter="g2p_pbms_dashboard.sr_db_password")
    sr_db_name = fields.Char(string="SR DB Name", config_parameter="g2p_pbms_dashboard.sr_db_name", default="socialregistrydb")
