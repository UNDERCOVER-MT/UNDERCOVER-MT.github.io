// Metadata management for layers
// This file handles CSV parsing and metadata display

const metadataConfig = {
    // Mapping between layer names and CSV data types
    layerToDataType: {
        'MT_2024': 'MT',
        'MT_BatCircle': 'MT',
        'MT_2026': 'MT',
        'AFMAG': 'AFMAG',
        'sAEM': 'Semi-airborne EM',
        '3D IP Receivers': '3D CSEM/IP',
        '3D IP TX Electrodes': '3D CSEM/IP',
        'ExtrEM Receivers': 'CSEM profile (ExtrEM)',
        'ExtrEM TX Lines': 'CSEM profile (ExtrEM)',
        'UC': 'Large-N passive seismic',
        'Broadband': 'Regional passive seismic'
    }
};

// Store parsed metadata
let metadataStore = {};

/**
 * Parse CSV data and create metadata lookup
 * @param {string} csvText - Raw CSV text content
 */
function parseMetadataCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return;

    const headers = lines[0].split(',').map(h => h.trim());

    // Find the index of 'Data Type' column
    const dataTypeIndex = headers.findIndex(h => h === 'Data Type');
    if (dataTypeIndex === -1) return;

    // Parse each row
    for (let i = 1; i < lines.length; i++) {
        // Handle commas inside quotes
        const row = parseCSVRow(lines[i]);
        if (row.length > 0) {
            const dataType = row[dataTypeIndex]?.trim();
            if (dataType) {
                // Create metadata object from headers and row values
                const metadata = {};
                headers.forEach((header, idx) => {
                    metadata[header] = row[idx]?.trim() || '';
                });
                metadataStore[dataType] = metadata;
            }
        }
    }
}

/**
 * Parse a CSV row handling quoted fields
 * @param {string} line - CSV line
 * @returns {string[]} Array of field values
 */
function parseCSVRow(line) {
    const result = [];
    let current = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"') {
            if (insideQuotes && nextChar === '"') {
                current += '"';
                i++;
            } else {
                insideQuotes = !insideQuotes;
            }
        } else if (char === ',' && !insideQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

/**
 * Load metadata from CSV file
 * @param {string} csvUrl - URL to the CSV file
 * @returns {Promise<void>}
 */
async function loadMetadata(csvUrl) {
    try {
        const response = await fetch(csvUrl);
        const csvText = await response.text();
        parseMetadataCSV(csvText);
        console.log('Metadata loaded:', metadataStore);
    } catch (error) {
        console.error('Error loading metadata:', error);
    }
}

/**
 * Get metadata for a layer
 * @param {string} layerName - Name of the layer
 * @returns {Object|null} Metadata object or null if not found
 */
function getLayerMetadata(layerName) {
    const dataType = metadataConfig.layerToDataType[layerName];
    return dataType ? metadataStore[dataType] : null;
}

/**
 * Create HTML for info icon with click handler
 * @param {string} layerName - Name of the layer
 * @returns {string} HTML string for the info icon
 */
function createInfoIcon(layerName) {
    return `<i class="fa fa-info-circle metadata-info-icon" data-layer="${layerName}" 
                  style="cursor: pointer; margin-left: 5px; color: #666; font-size: 14px;"
                  title="Click for metadata"></i>`;
}

/**
 * Display metadata in a modal
 * @param {string} layerName - Name of the layer
 */
function showMetadataModal(layerName) {
    const metadata = getLayerMetadata(layerName);
    if (!metadata) {
        alert(`No metadata found for ${layerName}`);
        return;
    }

    const dataType = metadataConfig.layerToDataType[layerName];

    // Build HTML table for metadata
    let tableHtml = '<table class="table table-sm table-striped"><tbody>';
    for (const [key, value] of Object.entries(metadata)) {
        const displayValue = value || '<em>N/A</em>';
        // Check if it's an email
        const isEmail = value && value.includes('@');
        const cellContent = isEmail ?
            `<a href="mailto:${value}">${value}</a>` :
            displayValue;
        tableHtml += `<tr><th style="width: 30%;">${key}:</th><td>${cellContent}</td></tr>`;
    }
    tableHtml += '</tbody></table>';

    // Update modal
    const modalTitle = document.getElementById('metadataModalTitle');
    const modalBody = document.getElementById('metadataModalBody');

    if (modalTitle) {
        modalTitle.textContent = `${dataType} - Metadata`;
    }
    if (modalBody) {
        modalBody.innerHTML = tableHtml;
    }

    // Show modal
    const modal = document.getElementById('metadataModal');
    if (modal) {
        const bootstrapModal = new bootstrap.Modal(modal);
        bootstrapModal.show();
    } else {
        console.error('Metadata modal not found');
    }
}

/**
 * Initialize metadata event listeners
 * Call this after the DOM is ready and layers are configured
 */
function initMetadataListeners() {
    document.addEventListener('click', function (e) {
        if (e.target.classList.contains('metadata-info-icon')) {
            const layerName = e.target.dataset.layer;
            showMetadataModal(layerName);
        }
    });
}
