/** @odoo-module **/
import {Component, onWillStart, useRef, onMounted, onWillUpdateProps, onWillUnmount} from "@odoo/owl";
import {useService} from "@web/core/utils/hooks";
import {loadJS, loadCSS} from "@web/core/assets";


export class MapComponent extends Component {
    setup() {
        this.mapRef = useRef("map");
        this.notification = useService("notification");
        this.map = null;
        this.geoJsonLayer = null;
        this.markerLayer = null;
        this.currentLevel = "province";
        this.selectedProvinceCode = null;
        this.provinceData = {};

        onWillStart(async () => {
            try {
                // Load dependencies
                await loadJS("https://unpkg.com/chroma-js@2.4.2/chroma.min.js");
                await loadCSS("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css");
                await loadJS("https://unpkg.com/leaflet@1.9.4/dist/leaflet.js");

                // Fetch Data from local module
                const [provinceRes, districtRes] = await Promise.all([
                    fetch("/g2p_pbms_dashboard/static/lib/tz.json"),
                    fetch("/g2p_pbms_dashboard/static/lib/geoBoundaries-TZA-ADM2.geojson"),
                ]);

                if (!provinceRes.ok || !districtRes.ok) throw new Error("GeoJSON Load Error");

                const fullProvinceData = await provinceRes.json();
                const fullDistrictData = await districtRes.json();

                // --- CONFIGURATION ---
                const zanzibarCodes = ["TZ06", "TZ07", "TZ10", "TZ11", "TZ15"];
                const PEMBA_CODES = ["TZ06", "TZ10"]; 

                const SHIFT_X = 0;
                const SHIFT_Y = -0.3;

                const transform = (f, code) =>
                    PEMBA_CODES.includes(code) ? this.shiftFeature(f, SHIFT_X, SHIFT_Y) : f;

                this.provinceGeoJson = {
                    type: "FeatureCollection",
                    features: fullProvinceData.features
                        .filter((f) => zanzibarCodes.includes(f.properties?.id))
                        .map((f) => transform(f, f.properties.id)),
                };

                this.districtGeoJson = {
                    type: "FeatureCollection",
                    features: fullDistrictData.features
                        .filter((f) => zanzibarCodes.includes(f.properties?.province_code))
                        .map((f) => transform(f, f.properties?.province_code)),
                };

                this.provinceData = this.computeProvinceData(this.props.data || {});
            } catch (err) {
                console.error("Map Init Failed:", err);
            }
        });

        onMounted(() => {
            if (this.mapRef.el) this.renderMap();
        });
        onWillUpdateProps((nextProps) => {
            this.provinceData = this.computeProvinceData(nextProps.data || {});

            if (!nextProps.filters.region && this.currentLevel === "district") {
                this.currentLevel = "province";
                this.selectedProvinceCode = null;
                this.renderProvinceLayer();
            } else {
                this.refreshCurrentLayer();
            }
        });
        onWillUnmount(() => this.map && this.map.remove());
    }

    shiftFeature(feature, dx, dy) {
        const shift = (coords) =>
            Array.isArray(coords[0]) ? coords.map(shift) : [coords[0] + dx, coords[1] + dy];

        return {
            ...feature,
            geometry: {...feature.geometry, coordinates: shift(feature.geometry.coordinates)},
        };
    }

    computeProvinceData(mapData) {
        const result = {};
        if (!this.districtGeoJson?.features) return result;
        for (const f of this.districtGeoJson.features) {
            const d = f.properties?.shapeName;
            const p = f.properties?.province_code;
            if (p) result[p] = (result[p] || 0) + (mapData[d] || 0);
        }
        return result;
    }

    getGradientColor(baseColor, value, max = 1000) {
        const scale = chroma
            .scale([chroma(baseColor).darken(2), baseColor, "#38bdf8"])
            .mode("lch")
            .domain([0, max / 2, max]);
        return scale(value).hex();
    }

    renderMap() {
        if (!this.mapRef.el || typeof L === "undefined") return;

        this.map = L.map(this.mapRef.el, {
            zoomControl: false,
            attributionControl: false,
            zoomSnap: 0.1, 
            scrollWheelZoom: false,
            doubleClickZoom: false,
        });

        this.markerLayer = L.layerGroup().addTo(this.map);
        this.renderProvinceLayer();
    }

    refreshCurrentLayer() {
        this.currentLevel === "province"
            ? this.renderProvinceLayer()
            : this.renderDistrictLayer(this.selectedProvinceCode);
    }

    addValueMarker(latlng, name, value, percent) {
        const icon = L.divIcon({
            className: "o_map_text_label",
            html: `
                <span class="o_map_label_name">${name} <br/></span>
                <span class="o_map_label_value">${value.toLocaleString()}</span>
            `,
            iconSize: [0, 0],
            iconAnchor: [0, 0],
        });
        L.marker(latlng, {icon, interactive: false}).addTo(this.markerLayer);
    }

    fitToLayer() {
        if (!this.map || !this.geoJsonLayer) return;
        this.map.fitBounds(this.geoJsonLayer.getBounds(), {padding: [5, 5], animate: true});
    }

    renderProvinceLayer() {
        if (this.geoJsonLayer) this.map.removeLayer(this.geoJsonLayer);
        this.markerLayer.clearLayers();

        const PROVINCE_COLORS = {
            TZ06: "#34d399",
            TZ07: "#60a5fa",
            TZ10: "#fbbf24",
            TZ11: "#f87171",
            TZ15: "#a78bfa",
        };

        this.geoJsonLayer = L.geoJson(this.provinceGeoJson, {
            style: (f) => ({
                fillColor: PROVINCE_COLORS[f.properties.id] || "#e2e8f0",
                weight: 2,
                color: "#ffffff",
                opacity: 1,
                fillOpacity: 0.85,
            }),
            onEachFeature: (f, layer) => {
                const val = this.provinceData[f.properties.id] || 0;
                const total = Object.values(this.provinceData).reduce((a, b) => a + b, 0);
                this.addValueMarker(
                    layer.getBounds().getCenter(),
                    f.properties.name,
                    val,
                    total ? (val / total) * 100 : 0
                );
                layer.on({
                    mouseover: (e) => {
                        e.target.setStyle({weight: 3, fillOpacity: 1});
                    },
                    mouseout: (e) => {
                        this.geoJsonLayer.resetStyle(e.target);
                    },

                    click: () => {
                        this.props.onMapClick({region: f.properties.name});
                        this.drillDownToProvince(f.properties.id);
                    },
                });
            },
        }).addTo(this.map);

        this.fitToLayer();
    }

    drillDownToProvince(code) {
        const hasData = this.districtGeoJson?.features.some(
            (f) => f.properties?.province_code === code
        );
        if (!hasData) return;

        this.currentLevel = "district";
        this.selectedProvinceCode = code;
        this.renderDistrictLayer(code);
    }

    renderDistrictLayer(code) {
        if (this.geoJsonLayer) this.map.removeLayer(this.geoJsonLayer);
        this.markerLayer.clearLayers();

        const PROVINCE_COLORS = {
            TZ06: "#34d399",
            TZ07: "#60a5fa",
            TZ10: "#fbbf24",
            TZ11: "#f87171",
            TZ15: "#a78bfa",
        };
        const parentColor = PROVINCE_COLORS[code] || "#94a3b8";
        const features = this.districtGeoJson.features.filter(
            (f) => f.properties?.province_code === code
        );

        this.geoJsonLayer = L.geoJson(
            {type: "FeatureCollection", features},
            {
                style: (f) => ({
                    fillColor: this.getGradientColor(
                        parentColor,
                        this.props.data[f.properties.shapeName] || 0,
                        500
                    ),
                    weight: 1.5,
                    color: "#ffffff",
                    fillOpacity: 0.85,
                }),
                onEachFeature: (f, layer) => {
                    const val = this.props.data[f.properties.shapeName] || 0;

                    this.addValueMarker(
                        layer.getBounds().getCenter(),
                        f.properties.shapeName,
                        val,
                        0
                    );
                    layer.on({
                        mouseover: (e) => {
                            e.target.setStyle({weight: 3, fillOpacity: 1});
                        },
                        mouseout: (e) => {
                            this.geoJsonLayer.resetStyle(e.target);
                        },
                        click: (e) => {
                            this.props.onMapClick({region: null});
                            this.currentLevel = "province";
                            this.selectedProvinceCode = null;
                            this.renderProvinceLayer();
                        },
                    });
                },
            }
        ).addTo(this.map);
        this.fitToLayer();
    }
}

MapComponent.template = "g2p_pbms_dashboard.MapComponent";
MapComponent.props = {
    data: {type: Object, optional: true},
    filters: {type: Object, optional: true},
    onMapClick: {type: Function, optional: true},
};
