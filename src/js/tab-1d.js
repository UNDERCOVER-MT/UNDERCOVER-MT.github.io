// src/js/tab-1d.js
(function () {

    // -----------------------------
    // CONFIG: column indices in your "data"
    // -----------------------------
    const IDX_LON = 0;
    const IDX_LAT = 1;
    const IDX_DEPTH = 2;

    const IDX_RESLOG = 3;   // log10(resistivity)
    const IDX_MOHO = 4;   // Moho depth (km)

    // Change these if needed:
    const IDX_GRAV = 6;   // gravity value column
    const IDX_MAG = 7;   // magnetic value column

    // how close two points must be to be considered "same location"
    const COORD_TOL = 1e-6;

    let map1d = null;
    let pointsLayer = null;

    let oneDChart = null;
    let chartInitialized = false;

    // -----------------------------------
    // Helpers
    // -----------------------------------
    function sameCoord(a, b, tol = COORD_TOL) {
        return Math.abs(a - b) <= tol;
    }

    // Group raw rows by unique (lon,lat)
    function uniqueLocationsFromData(allRows) {
        const locs = [];
        const seen = new Set();

        for (const d of allRows) {
            const lon = d[IDX_LON];
            const lat = d[IDX_LAT];
            const key = `${lon.toFixed(6)}_${lat.toFixed(6)}`;

            if (!seen.has(key)) {
                seen.add(key);
                locs.push({ lon, lat });
            }
        }
        return locs;
    }

    // Get all rows for a clicked location (lon,lat)
    function rowsForLocation(allRows, lon, lat) {
        return allRows.filter(d =>
            sameCoord(d[IDX_LON], lon) && sameCoord(d[IDX_LAT], lat)
        );
    }

    // Prepare series data: [x, y] with y=depth (so depth increases downward)
    function buildProfileSeries(rows) {
        // Moho depth: take first valid value found
        let mohoDepth = null;
        for (const d of rows) {
            const m = Number(d[IDX_MOHO]) * 1000; // convert km to m if needed
            if (Number.isFinite(m)) { mohoDepth = m; break; }
        }

        // Build a map keyed by depth -> keep one record (or average later)
        const byDepth = new Map();

        for (const d of rows) {
            const depth = Number(d[IDX_DEPTH]);
            const grav = Number(d[IDX_GRAV]);
            const mag = Number(d[IDX_MAG]);
            // const res = Math.pow(10, Number(d[IDX_RESLOG])); // log10 -> linear
            const res = Number(d[IDX_RESLOG]); // log10 -> linear

            if (![depth, grav, mag, res].every(Number.isFinite)) continue;

            // If multiple rows share the same depth, keep the first (or replace)
            // Use a tolerance if depth is floaty (e.g., 10.0000001)
            const key = depth.toFixed(4);

            if (!byDepth.has(key)) {
                byDepth.set(key, { depth, grav, mag, res });
            }
        }

        const sorted = Array.from(byDepth.values()).sort((a, b) => a.depth - b.depth);

        const depths = sorted.map(o => o.depth);

        return {
            gravSeries: sorted.map(o => [o.grav, o.depth]),
            magSeries: sorted.map(o => [o.mag, o.depth]),
            resSeries: sorted.map(o => [o.res, o.depth]),
            depthMin: Math.min(...depths),
            depthMax: Math.max(...depths),
            mohoDepth
        };
    }


    // -----------------------------------
    // ECharts init + update
    // -----------------------------------
    function init1DChart() {
        if (chartInitialized) return;

        const el = document.getElementById('oneDChart');
        if (!el) return;

        oneDChart = echarts.init(el);

        const option = {
            title: { text: '1D Gravity, Magnetics & Resistivity', left: '1%' },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'cross' },
                backgroundColor: 'rgba(255,255,255,0.95)',
                borderColor: '#ddd',
                borderWidth: 1,
                textStyle: { color: '#222', fontSize: 12 },
                confine: true,  // keep inside panel
                formatter: function (params) {
                    // params is array of series at that depth
                    const depth = params?.[0]?.value?.[1];

                    const lines = params.map(p => {
                        const x = p.value[0];
                        if (p.seriesName === 'Resistivity') {
                            return `<span style="color:${p.color}">●</span> ${p.seriesName}: <b>${Number(x).toFixed(0)}</b> ohm·m`;
                        }
                        return `<span style="color:${p.color}">●</span> ${p.seriesName}: <b>${Number(x).toFixed(4)}</b>`;
                    });

                    return `
      <div style="min-width:180px">
        <div><b>Depth:</b> ${Number(depth).toFixed(2) / 1000} km</div>
        <hr style="margin:6px 0"/>
        ${lines.join('<br/>')}
      </div>
    `;
                }
            },


            legend: { top: 30, data: ['Gravity', 'Magnetics', 'Resistivity'] },
            grid: {
                left: '10%',
                right: '10%',
                top: 80,
                bottom: 70,       // ✅ important because you have 2 bottom axes
                containLabel: true
            },


            yAxis: {
                name: 'Depth (km)',
                type: 'value',
                inverse: true
            },

            // 3 different X axes
            xAxis: [
                {
                    name: 'Gravity',
                    type: 'value',
                    position: 'top',
                    splitLine: { show: false },
                    axisLine: { lineStyle: { color: '#2E86DE' } },
                    axisLabel: { color: '#2E86DE' },
                    nameTextStyle: { color: '#2E86DE', fontWeight: 'bold' }
                },
                {
                    name: 'Magnetics',
                    type: 'value',
                    position: 'bottom',
                    splitLine: { show: false },
                    axisLine: { lineStyle: { color: '#E74C3C' } },
                    axisLabel: { color: '#E74C3C' },
                    nameTextStyle: { color: '#E74C3C', fontWeight: 'bold' }
                },
                {
                    name: 'Resistivity (ohm·m)',
                    type: 'log',                 // log axis
                    position: 'bottom',
                    offset: 40,                  // push below the magnetics axis
                    splitLine: { show: false },
                    axisLine: { lineStyle: { color: '#27AE60' } },
                    axisLabel: { color: '#27AE60' },
                    nameTextStyle: { color: '#27AE60', fontWeight: 'bold' }
                }
            ],

            series: [
                {
                    name: 'Gravity',
                    type: 'line',
                    step: 'end',
                    showSymbol: false,
                    xAxisIndex: 0,
                    data: [],
                    lineStyle: { width: 2, color: '#2E86DE' },
                    itemStyle: { color: '#2E86DE' }
                },
                {
                    name: 'Magnetics',
                    type: 'line',
                    step: 'end',
                    showSymbol: false,
                    xAxisIndex: 1,
                    data: [],
                    lineStyle: { width: 2, color: '#E74C3C' },
                    itemStyle: { color: '#E74C3C' }
                },
                {
                    name: 'Resistivity',
                    type: 'line',
                    step: 'end',
                    showSymbol: false,
                    xAxisIndex: 2,
                    data: [],
                    lineStyle: { width: 2, color: '#27AE60' },
                    itemStyle: { color: '#27AE60' }
                }
            ]
        };


        oneDChart.setOption(option);
        chartInitialized = true;
    }

    function updateChartForLocation(rows, lon, lat) {
        init1DChart();

        if (!oneDChart) return;

        if (!rows || rows.length === 0) {
            oneDChart.setOption({
                title: { text: 'No profile data for this point' },
                series: [{ data: [] }, { data: [] }]
            });
            return;
        }

        const { gravSeries, magSeries, resSeries, depthMin, depthMax, mohoDepth } = buildProfileSeries(rows);

        const mohoMarkLine = mohoDepth == null ? null : {
            silent: true,
            animation: false,
            data: [{
                name: 'Moho',
                yAxis: mohoDepth,
                // label: { formatter: 'Moho: {c} km', position: 'insideEndTop' }
                label: { formatter: 'Moho', position: 'insideEndTop' }
            }],
            lineStyle: {
                width: 2,
                type: 'dashed',
                color: '#7f8c8d'
            }
        };

        oneDChart.setOption({
            title: { text: `1D Profiles (lon=${lon.toFixed(3)}, lat=${lat.toFixed(3)})` },
            yAxis: { min: depthMin, max: depthMax },

            series: [
                { name: 'Gravity', data: gravSeries, markLine: mohoMarkLine || undefined },
                { name: 'Magnetics', data: magSeries },
                { name: 'Resistivity', data: resSeries }
            ]
        });

    }

    // -----------------------------------
    // Leaflet init for 1D tab
    // -----------------------------------
    function init1DMap() {
        if (map1d) return;

        map1d = L.map('map1d', {
            zoom: 8,
            minZoom: 2,
            center: L.latLng([66, 28.2]),
            attributionControl: true
        });

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap'
        }).addTo(map1d);

        pointsLayer = L.layerGroup().addTo(map1d);

        // Add unique location points
        if (typeof data !== 'undefined' && Array.isArray(data)) {
            const locs = uniqueLocationsFromData(data);

            locs.forEach(({ lon, lat }) => {
                const marker = L.circleMarker([lat, lon], {
                    radius: 5,
                    fillColor: '#0077ff',
                    color: '#000',
                    weight: 1,
                    fillOpacity: 0.6
                });

                marker.on('click', () => {
                    const rows = rowsForLocation(data, lon, lat);
                    updateChartForLocation(rows, lon, lat);
                });

                marker.addTo(pointsLayer);
            });

            // Optional: set view to points extent (if enough points)
            if (locs.length > 1) {
                const latlngs = locs.map(p => [p.lat, p.lon]);
                map1d.fitBounds(latlngs, { padding: [20, 20] });
            } else if (locs.length === 1) {
                map1d.setView([locs[0].lat, locs[0].lon], 8);
            }

            // Load a default profile (first location)
            if (locs.length >= 1) {
                const first = locs[0];
                const rows = rowsForLocation(data, first.lon, first.lat);
                updateChartForLocation(rows, first.lon, first.lat);
            }
        }

        setTimeout(() => map1d.invalidateSize(), 50);
    }

    // -----------------------------------
    // Resizable + collapsible panel (same as before, but also resizes chart)
    // -----------------------------------
    function setup1DPanel() {
        const panel = document.getElementById('oneDPanel');
        const handle = document.getElementById('oneDHandle');
        const toggleBtn = document.getElementById('oneDToggle');

        if (!panel || !handle || !toggleBtn) return;

        let dragging = false;
        let startY = 0;
        let startHeight = 0;

        const MIN_H = 140;
        const MAX_H = Math.floor(window.innerHeight * 0.75);

        function setPanelHeight(h) {
            const height = Math.max(MIN_H, Math.min(MAX_H, h));
            panel.style.flexBasis = height + 'px';
            panel.style.height = height + 'px';

            if (oneDChart) oneDChart.resize();
            if (map1d) map1d.invalidateSize();
        }

        handle.addEventListener('mousedown', (e) => {
            if (e.target === toggleBtn) return;

            dragging = true;
            startY = e.clientY;
            startHeight = panel.getBoundingClientRect().height;
            document.body.style.cursor = 'ns-resize';
            document.body.style.userSelect = 'none';
        });

        window.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            const dy = startY - e.clientY;
            setPanelHeight(startHeight + dy);
        });

        window.addEventListener('mouseup', () => {
            if (!dragging) return;
            dragging = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        });

        toggleBtn.addEventListener('click', () => {
            panel.classList.toggle('is-collapsed');
            toggleBtn.textContent = panel.classList.contains('is-collapsed') ? 'Expand' : 'Collapse';

            setTimeout(() => {
                if (map1d) map1d.invalidateSize();
                if (oneDChart) oneDChart.resize();
            }, 80);
        });

        window.addEventListener('resize', () => {
            if (map1d) map1d.invalidateSize();
            if (oneDChart) oneDChart.resize();
        });
    }

    // -----------------------------------
    // Bootstrap tab hook
    // -----------------------------------
    document.addEventListener('DOMContentLoaded', () => {
        const tabBtn = document.getElementById('models1d-tab');
        if (tabBtn) {
            tabBtn.addEventListener('shown.bs.tab', () => {
                init1DMap();
                init1DChart();
                setTimeout(() => { if (oneDChart) oneDChart.resize(); }, 80);
            });
        }

        setup1DPanel();
    });

})();














// let map1dChart = null;     // echarts instance for the 2D map
// let lmap1d = null;         // leaflet instance (inside echarts extension)

// function init1DDepthMap() {
//   if (map1dChart) return;
//   if (typeof echarts === 'undefined') return;

//   // ---- pick 5 depth levels from your data (auto)
//   const uniqueDepths = Array.from(
//     new Set(data.map(d => Number(d[IDX_DEPTH])).filter(Number.isFinite))
//   ).sort((a, b) => a - b);

//   // If there are many, choose 5 evenly-spaced depths
//   const depthLevels = pickFiveDepths(uniqueDepths); // returns numbers

//   const timelineLabels = depthLevels.map(d => `${d.toFixed(0)}`); // show as km labels
//   const depthKeys = depthLevels.map(d => d);                      // actual values

//   // ---- base option
//   const option = {
//     timeline: {
//       data: timelineLabels,
//       axisType: 'category',
//       autoPlay: false,
//       playInterval: 2000,
//       loop: true,
//       bottom: 10,
//       label: {
//         fontSize: 12,
//         formatter: s => `${s} km`
//       }
//     },

//     tooltip: {
//       trigger: 'item',
//       backgroundColor: 'rgba(255,255,255,0.95)',
//       borderColor: '#ddd',
//       borderWidth: 1,
//       textStyle: { color: '#222', fontSize: 12 },
//       formatter: function (p) {
//         // p.data = [lon, lat, depth, log10Res, ...]
//         const lon = p.data[IDX_LON];
//         const lat = p.data[IDX_LAT];
//         const dep = p.data[IDX_DEPTH];
//         const res = Math.pow(10, Number(p.data[IDX_RESLOG]));
//         return (
//           `<b>Lon:</b> ${Number(lon).toFixed(3)}<br>` +
//           `<b>Lat:</b> ${Number(lat).toFixed(3)}<br>` +
//           `<b>Depth:</b> ${Number(dep).toFixed(2)} km<br>` +
//           `<b>Res:</b> ${Number(res).toFixed(0)} ohm·m`
//         );
//       }
//     },

//     // IMPORTANT: ECharts-leaflet config
//     lmap: {
//       center: [28.2, 66], // [lng, lat] NOTE: extension uses [lng, lat]
//       zoom: 7,
//       resizeEnable: true,
//       renderOnMoving: true,
//       echartsLayerInteractive: true,
//       largeMode: true
//     },

//     visualMap: {
//       show: true,
//       type: 'continuous',
//       min: 0,
//       max: 4,
//       dimension: IDX_RESLOG,     // log10(res) column
//       calculable: true,
//       orient: 'horizontal',
//       left: 40,
//       right: 40,
//       top: 10,
//       text: ['log10(Res)', ''],
//       textStyle: { fontSize: 12 }
//     },

//     series: [
//       {
//         type: 'scatter',
//         coordinateSystem: 'lmap',
//         symbol: 'circle',
//         symbolSize: 7,
//         data: [] // filled by timeline options
//       }
//     ],

//     // one option per depth slice
//     options: depthKeys.map(depth => ({
//       series: [{
//         data: data.filter(d => approxEqual(Number(d[IDX_DEPTH]), depth, 1e-4))
//       }]
//     }))
//   };

//   map1dChart = echarts.init(document.getElementById('map1d'));
//   map1dChart.setOption(option);

//   // get Leaflet instance so you can add base map controls if needed
//   const comp = map1dChart.getModel().getComponent('lmap');
//   lmap1d = comp.getLeaflet();

//   // Add iconLayers/providers if you want same basemap switcher
//   // (optional — you can keep default tile from extension)
//   if (typeof providers !== 'undefined') {
//     const layers = [];
//     for (const providerId in providers) layers.push(providers[providerId]);
//     L.control.iconLayers(layers).addTo(lmap1d);
//   }

//   L.control.scale({ imperial: false }).addTo(lmap1d);

//   // CLICK -> update the bottom 1D profile using lon/lat
//   map1dChart.on('click', { seriesIndex: 0 }, function (params) {
//     const lon = Number(params.data[IDX_LON]);
//     const lat = Number(params.data[IDX_LAT]);

//     const rows = rowsForLocation(data, lon, lat);
//     updateChartForLocation(rows, lon, lat);
//   });

//   // Default selection: first point in first slice
//   const firstSlice = data.filter(d => approxEqual(Number(d[IDX_DEPTH]), depthKeys[0], 1e-4));
//   if (firstSlice.length > 0) {
//     const lon = Number(firstSlice[0][IDX_LON]);
//     const lat = Number(firstSlice[0][IDX_LAT]);
//     const rows = rowsForLocation(data, lon, lat);
//     updateChartForLocation(rows, lon, lat);
//   }

//   // Handle resize inside tab/panel
//   setTimeout(() => map1dChart.resize(), 60);
// }


// // helper: choose 5 depth levels evenly spaced from available depths
// function pickFiveDepths(arr) {
//   if (!arr || arr.length === 0) return [1, 5, 10, 20, 40];
//   if (arr.length <= 5) return arr;

//   const idxs = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(f * (arr.length - 1)));
//   // unique indices
//   const uniq = Array.from(new Set(idxs)).map(i => arr[i]);
//   // ensure exactly 5 (pad if needed)
//   while (uniq.length < 5) uniq.push(arr[Math.min(arr.length - 1, uniq.length)]);
//   return uniq.slice(0, 5);
// }

// function approxEqual(a, b, tol) {
//   return Math.abs(a - b) <= tol;
// }
