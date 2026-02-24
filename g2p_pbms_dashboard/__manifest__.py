{
    'name': 'G2P PBMS Dashboard',
    'version': '1.0',
    'category': 'OpenG2P',
    'depends': ['web', 'g2p_pbms'],
    'data': [
        'security/ir.model.access.csv',
        'views/dashboard_menu.xml',
        'views/res_config_settings_view.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'g2p_pbms_dashboard/static/src/css/dashboard.css',
            'g2p_pbms_dashboard/static/src/components/**/*.css',
            'g2p_pbms_dashboard/static/src/components/**/*.js',
            'g2p_pbms_dashboard/static/src/components/**/*.xml',
            'g2p_pbms_dashboard/static/src/js/dashboard.js',
            'g2p_pbms_dashboard/static/src/xml/dashboard.xml',
        ],
    },
    'installable': True,
    'application': True,
}
