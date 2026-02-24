/** @odoo-module */

import { Component, useState, onWillStart } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { MapComponent } from "@g2p_pbms_dashboard/components/map/map_component";
import { ChartComponent } from "@g2p_pbms_dashboard/components/chart/chart";
import { KpiComponent } from "@g2p_pbms_dashboard/components/kpi/kpi";

export class PBMSDashboard extends Component {
    setup() {
        this.orm = useService("orm");
        this.state = useState({
            kpi: {
                total_enrolled: 0,
                total_disbursed_amount: 0,
                total_budget_allocated: 0,
                program_count: 0
            },
            charts: {
                age: {},
                gender: {},
                region: {}
            },
            map_data: {},
            programs: [],
            loading: true,
            filters: {
                gender: null,
                age_bucket: null,
                region: null,
                district: null,
                program_id: null,
            },
            activeTab: 'summary',
            beneficiaries: {
                data: [],
                total: 0,
                page: 1,
                pageSize: 20,
                loading: false
            },
            searchTerm: ''
        });
        
        // Bind methods
        this.applyFilterFromChart = this.applyFilterFromChart.bind(this);
        this.applyFilterFromMap = this.applyFilterFromMap.bind(this);
        this.clearFilters = this.clearFilters.bind(this);
        this.fetchData = this.fetchData.bind(this);
        
        // Load initial data
        onWillStart(async () => {
            await this.fetchData();
        });
    }

    async fetchData() {
        try {
            this.state.loading = true;
            
            // Get dashboard data using ORM call to our logic model
            const data = await this.orm.call(
                "g2p.pbms.dashboard.logic",
                "get_dashboard_data",
                [],
                { filters: this.state.filters }
            );
            
            if (data) {
                // Update KPIs
                this.state.kpi = data.kpi;
                
                // Update charts data
                this.state.charts = data.charts;
                
                // Update map data
                this.state.map_data = data.map_data;
                
                // Load programs
                this.state.programs = data.programs;
            }
            
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            this.state.loading = false;
        }
    }
    
    setFilterProgram(programId) {
        this.state.filters.program_id = programId ? parseInt(programId) : null;
        this.fetchData();
    }

    setFilterGender(gender) {
        this.state.filters.gender = gender || null;
        this.fetchData();
    }

    setFilterAgeBucket(bucket) {
        this.state.filters.age_bucket = bucket || null;
        this.fetchData();
    }

    applyFilterFromChart(payload) {
        if (!payload || !payload.chartType) return;

        if (payload.chartType === "gender") {
            const g = payload.label === "Male" ? "male" : payload.label === "Female" ? "female" : null;
            this.state.filters.gender = this.state.filters.gender === g ? null : g;
        } else if (payload.chartType === "age") {
            const key = payload.label;
            this.state.filters.age_bucket = this.state.filters.age_bucket === key ? null : key;
        } else if (payload.chartType === "region") {
            this.state.filters.region = this.state.filters.region === payload.label ? null : payload.label;
            this.state.filters.district = null; 
        }
        this.fetchData();
    }

    applyFilterFromMap(payload) {
        if (!payload) return;
        
        if (payload.region !== undefined) {
            this.state.filters.region = payload.region;
            this.state.filters.district = null;
        }
        if (payload.district !== undefined) {
            this.state.filters.district = this.state.filters.district === payload.district ? null : payload.district;
        }
        this.fetchData();
    }

    clearFilters() {
        this.state.filters = { 
            gender: null, 
            age_bucket: null, 
            region: null, 
            district: null,
            program_id: null
        };
        this.fetchData();
    }

    get hasActiveFilters() {
        return Object.values(this.state.filters).some(v => v !== null);
    }
}

PBMSDashboard.template = "g2p_pbms_dashboard.PBMSMainLayout";
PBMSDashboard.components = { MapComponent, ChartComponent, KpiComponent };
registry.category("actions").add("pbms_dashboard_main", PBMSDashboard);
