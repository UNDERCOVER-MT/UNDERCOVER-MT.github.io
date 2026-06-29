(function () {
    if (!window.L || !L.Map || !L.Draggable) return;

    L.Map.PopupMovable = L.Class.extend({
        initialize: function (map) {
            this._map = map;
            map.on('popupopen', this._onPopupOpen, this);
            map.on('popupclose', this._onPopupClose, this);
            map.on('move zoom resize', this._updatePopupLines, this);
        },

        _onPopupOpen: function (event) {
            const popup = event.popup;
            const container = popup.getElement && popup.getElement();

            if (!container || popup.options.popupmovable === false) return;

            L.DomUtil.addClass(container, 'leaflet-popup-movable');
            L.DomEvent.disableClickPropagation(container);
            L.DomEvent.disableScrollPropagation(container);

            const lead = this._createLeadLine();
            const draggable = new L.Draggable(container);

            popup._popupMovable = { draggable, lead };

            draggable.on('drag dragend', function () {
                this._updateLeadLine(popup);
            }, this);

            draggable.enable();
            this._updateLeadLine(popup);
        },

        _onPopupClose: function (event) {
            const movable = event.popup && event.popup._popupMovable;

            if (!movable) return;

            movable.draggable.disable();
            movable.lead.svg.remove();
            delete event.popup._popupMovable;
        },

        _createLeadLine: function () {
            const svg = L.SVG.create('svg');
            const line = L.SVG.create('line');

            L.DomUtil.addClass(svg, 'leaflet-popup-movable-lead');
            L.DomUtil.addClass(line, 'leaflet-popup-movable-line');
            svg.appendChild(line);
            this._map.getContainer().appendChild(svg);

            return { svg, line };
        },

        _updatePopupLines: function () {
            this._map.eachLayer(function (layer) {
                const popup = layer.getPopup && layer.getPopup();

                if (popup && popup.isOpen && popup.isOpen() && popup._popupMovable) {
                    this._updateLeadLine(popup);
                }
            }, this);
        },

        _updateLeadLine: function (popup) {
            const container = popup.getElement && popup.getElement();
            const movable = popup._popupMovable;

            if (!container || !movable || !popup.getLatLng()) return;

            const mapRect = this._map.getContainer().getBoundingClientRect();
            const popupRect = container.getBoundingClientRect();
            const source = this._map.latLngToContainerPoint(popup.getLatLng());
            const targetX = popupRect.left - mapRect.left + popupRect.width / 2;
            const targetY = popupRect.top - mapRect.top + popupRect.height;

            movable.lead.line.setAttribute('x1', source.x);
            movable.lead.line.setAttribute('y1', source.y);
            movable.lead.line.setAttribute('x2', targetX);
            movable.lead.line.setAttribute('y2', targetY);
        }
    });

    L.Map.addInitHook(function () {
        if (this.options.popupMovable) {
            this.popupMovable = new L.Map.PopupMovable(this);
        }
    });
})();
