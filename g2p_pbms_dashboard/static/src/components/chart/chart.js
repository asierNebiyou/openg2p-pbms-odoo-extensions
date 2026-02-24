/** @odoo-module */
/* global Chart, ChartDataLabels */

import { Component, onMounted, onWillStart, onWillUpdateProps, useRef } from "@odoo/owl";
import { loadJS } from "@web/core/assets";

export class ChartComponent extends Component {
    setup() {
        this.canvasRef = useRef("canvas");
        this.chartInstance = null;

        onWillStart(async () => {
            // Load Chart.js and the Datalabels plugin
            await loadJS("https://cdn.jsdelivr.net/npm/chart.js");
            await loadJS("https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0");
        });

        onMounted(() => this.renderChart());

        onWillUpdateProps(() => {
            if (this.chartInstance) {
                this.chartInstance.destroy();
                this.chartInstance = null;
            }
        });
    }

    patched() {
        if (this.canvasRef.el && !this.chartInstance) {
            this.renderChart();
        }
    }

    renderChart() {
        if (!this.canvasRef.el || !this.props.labels || !this.props.data) return;
        const ctx = this.canvasRef.el.getContext("2d");
        const defaultColors = [
            '#3b82f6', // Blue
            '#ec4899', // Pink
            '#8b5cf6', // Violet
            '#10b981', // Emerald
            '#f59e0b', // Amber
            '#06b6d4', // Cyan
            '#ef4444', // Red
            '#6366f1'  // Indigo
        ];

        let bgColors = this.props.backgroundColor;
        if (!bgColors || bgColors.length <= 1) {
            bgColors = defaultColors.slice(0, this.props.data.length);
        }

        let baseOptions = {
            maintainAspectRatio: false,
            onClick: (event, elements) => {
                if (elements.length > 0 && this.props.onSegmentClick) {
                    const index = elements[0].index;
                    const label = this.props.labels[index];
                    const value = this.props.data[index];
                    
                    this.props.onSegmentClick({
                        chartType: this.props.chartType,
                        label: label,
                        value: value
                    });
                }
            },
            layout: {
                padding: 10
            },
            plugins: {
                legend: {
                    display: this.props.type === 'pie' || this.props.type === 'doughnut',
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        padding: 12,
                        font: {
                            size: 11
                        }
                    }
                },
                datalabels: {
                    display: (context) => {
                        const value = context.dataset.data[context.dataIndex];
                        return value !== 0;
                    },
                    color: '#ffffff',
                    font: {
                        weight: 'bold',
                        size: 11
                    },
                    anchor: 'center',
                    align: 'center',
                    textAlign: 'center',
                    formatter: (value, context) => {
                        const label = this.props.labels[context.dataIndex] || "";
                        const dataset = context.chart.data.datasets[0].data;
                        const sum = dataset.reduce((a, b) => a + b, 0);
                        const percentage = sum > 0 ? ((value * 100) / sum).toFixed(0) + "%" : "0%";
                        return `${label}
${value} (${percentage})`;
                    },
                    textShadowBlur: 3,
                    textShadowColor: 'rgba(0, 0, 0, 0.5)',
                }
            }
        };

        let finalOptions = { ...baseOptions, ...(this.props.options || {}) };

        if (this.props.options && this.props.options.plugins) {
            finalOptions.plugins = {
                ...baseOptions.plugins,
                ...(this.props.options.plugins || {}),
            };
            finalOptions.plugins.datalabels = {
                ...(baseOptions.plugins.datalabels || {}),
                ...(this.props.options.plugins.datalabels || {})
            };
            finalOptions.plugins.legend = {
                ...(baseOptions.plugins.legend || {}),
                ...(this.props.options.plugins.legend || {})
            };
        }

        this.chartInstance = new Chart(ctx, {
            type: this.props.type,
            data: {
                labels: this.props.labels,
                datasets: [{
                    data: this.props.data,
                    backgroundColor: bgColors,
                    borderWidth: 1,
                }],
            },
            plugins: [ChartDataLabels],
            options: finalOptions,
        });
    }
}

ChartComponent.template = "g2p_pbms_dashboard.ChartTemplate";

ChartComponent.props = {
    type: { type: String, optional: true },
    labels: { type: Array, optional: true },
    title: { type: String, optional: true },
    data_label: { type: String, optional: true },
    data: { type: Array, optional: true },
    backgroundColor: { type: Array, optional: true },
    options: { type: Object, optional: true },
    size: { type: String, optional: true },
    chartType: { type: String, optional: true },
    onSegmentClick: { type: Function, optional: true },
};
