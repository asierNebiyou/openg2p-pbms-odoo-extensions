from odoo import fields, models

class ResConfigSettings(models.TransientModel):
    _inherit = "res.config.settings"

    bg_task_db_host = fields.Char(string="BG Task DB Host", config_parameter="g2p_pbms_dashboard.bg_task_db_host", default="localhost")
    bg_task_db_port = fields.Char(string="BG Task DB Port", config_parameter="g2p_pbms_dashboard.bg_task_db_port", default="5432")
    bg_task_db_user = fields.Char(string="BG Task DB User", config_parameter="g2p_pbms_dashboard.bg_task_db_user", default="postgres")
    bg_task_db_password = fields.Char(string="BG Task DB Password", config_parameter="g2p_pbms_dashboard.bg_task_db_password")
    bg_task_db_name = fields.Char(string="BG Task DB Name", config_parameter="g2p_pbms_dashboard.bg_task_db_name", default="bgtaskdb")
