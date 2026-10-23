/* Shared map controls for catalogue, cashier and delivery drivers. */
(() => {
  let configuration;
  let sdk;
  const config = () => configuration ||= window.ConfloraSession.apiFetch('/api/maps-config').then(async (response) => {
    if (!response.ok) throw new Error('map_unavailable_enter_the_address_and_use_external_navigation'.tr);
    return response.json();
  }).catch(error => { configuration = null; throw error; });
  const point = (value) => value && value.lat !== null && value.lng !== null && Number.isFinite(Number(value.lat)) && Number.isFinite(Number(value.lng)) && Math.abs(Number(value.lat)) <= 90 && Math.abs(Number(value.lng)) <= 180 ? { lat: Number(value.lat), lng: Number(value.lng) } : null;
  async function maps() {
    const settings = await config();
    if (window.google?.maps?.importLibrary) return window.google.maps;
    if (!settings.apiKey) throw new Error('the_map_is_not_configured_by_the_store_yet_you_can_use_gps_or_enter_the_full_address'.tr);
    sdk ||= new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const timeout = setTimeout(() => { script.remove(); reject(new Error('the_map_took_too_long_to_respond_use_gps_or_address'.tr)); }, 20000);
      window.confloraMapsReady = () => { clearTimeout(timeout); resolve(window.google.maps); };
      script.src = 'https://maps.googleapis.com/maps/api/js?' + new URLSearchParams({ key: settings.apiKey, v: 'weekly', loading: 'async', callback: 'confloraMapsReady', language: 'pt-BR', region: 'BR' });
      script.onerror = () => { clearTimeout(timeout); reject(new Error('could_not_load_the_map_use_gps_or_address'.tr)); };
      document.head.append(script);
    }).catch((error) => { sdk = null; throw error; });
    return sdk;
  }
  function navigation(location, address = '') {
    const coordinates = point(location);
    const destination = coordinates ? `${coordinates.lat},${coordinates.lng}` : address;
    return {
      google: 'https://www.google.com/maps/dir/?' + new URLSearchParams({ api: '1', destination, travelmode: 'driving', dir_action: 'navigate' }),
      waze: 'https://waze.com/ul?' + new URLSearchParams(coordinates ? { ll: destination, navigate: 'yes' } : { q: destination, navigate: 'yes' }),
    };
  }
  class LocationPicker extends HTMLElement {
    connectedCallback() {
      if (this.started) return;
      this.started = true;
      try { this.value = JSON.parse(this.getAttribute('value') || 'null'); } catch { this.value = null; }
      this.innerHTML = '<section class="cf-location"><strong>📍 Localização da entrega</strong><p>Marque a casa ou o portão no mapa. Confira também o endereço escrito.</p><div class="cf-location-actions"><button type="button" data-gps>Usar minha localização</button><button type="button" data-map>Selecionar no mapa</button></div><div data-search hidden><label>Buscar endereço no mapa<input type="search" placeholder="Rua, número, bairro e cidade" /></label><button type="button" data-find>Buscar endereço</button></div><div data-canvas class="cf-location-map" hidden></div><label>Ponto de referência (opcional)<input data-reference maxlength="200" placeholder="Ex.: portão verde, ao lado da escola" /></label><p data-status role="status"></p></section>';
      this.querySelector('[data-reference]').value = this.value?.reference || '';
      this.querySelector('[data-reference]').oninput = () => { if (this.value) this.emit(); };
      this.querySelector('[data-gps]').onclick = () => this.gps();
      this.querySelector('[data-map]').onclick = () => this.openMap();
      this.querySelector('[data-find]').onclick = () => this.find();
      if (point(this.value)) this.status('location_selected_you_can_adjust_the_pin_on_the_map'.tr);
    }
    status(text) { if (this.isConnected) this.querySelector('[data-status]').textContent = text; }
    emit() {
      this.value = { ...this.value, reference: this.querySelector('[data-reference]').value.trim() };
      this.dispatchEvent(new CustomEvent('locationchange', { bubbles: true, detail: this.value }));
    }
    async select(coordinates, address = '') {
      this.value = { ...coordinates, address: address || this.value?.address || this.getAttribute('address') || '' };
      if (this.marker) this.marker.position = coordinates;
      this.map?.panTo(coordinates); this.emit(); this.status('location_selected_check_the_address_and_reference_point'.tr);
      if (!address && this.geocoder) {
        const selected = this.value;
        try {
          const result = await this.geocoder.geocode({ location: coordinates });
          if (this.value !== selected || !this.isConnected) return;
          if (result.results?.[0]) { this.value.address = result.results[0].formatted_address; this.emit(); }
        } catch { /* Coordinates remain usable if reverse geocoding is unavailable. */ }
      }
    }
    gps() {
      if (!navigator.geolocation) return this.status('your_device_does_not_support_gps_search_for_the_address_on_the_map'.tr);
      this.status('locating_please_authorize_gps_in_your_browser'.tr);
      navigator.geolocation.getCurrentPosition(({ coords }) => {
        if (!this.isConnected) return;
        this.select({ lat: coords.latitude, lng: coords.longitude, accuracy: Math.round(coords.accuracy) });
        this.openMap();
      }, () => this.status('could_not_use_gps_search_for_the_address_or_select_the_pin_on_the_map'.tr), { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
    }
    async openMap() {
      if (this.opening) return this.opening;
      this.opening = this.loadMap().finally(() => { this.opening = null; this.querySelector('[data-map]')?.removeAttribute('aria-busy'); });
      return this.opening;
    }
    async loadMap() {
      this.querySelector('[data-search]').hidden = false;
      this.querySelector('input[type=search]').value ||= this.getAttribute('address') || '';
      if (this.map) return;
      this.status('loading_map'.tr); this.querySelector('[data-map]').setAttribute('aria-busy', 'true');
      try {
        const googleMaps = await maps(); const settings = await config();
        const [{ Map }, { AdvancedMarkerElement }, { Geocoder }] = await Promise.all([googleMaps.importLibrary('maps'), googleMaps.importLibrary('marker'), googleMaps.importLibrary('geocoding')]);
        if (!this.isConnected) return;
        const center = point(this.value) || point(settings.storeLocation) || { lat: -17.5694, lng: -52.5511 };
        const canvas = this.querySelector('[data-canvas]'); canvas.hidden = false;
        this.map = new Map(canvas, { center, zoom: 16, mapId: settings.mapId || 'DEMO_MAP_ID', mapTypeControl: false, streetViewControl: false });
        this.geocoder = new Geocoder();
        this.marker = new AdvancedMarkerElement({ map: this.map, position: center, gmpDraggable: true, title: 'delivery_location_3bcbfe'.tr });
        this.listeners = [this.map.addListener('click', (event) => this.select(event.latLng.toJSON()))];
        this.listeners.push(this.marker.addListener('dragend', () => { const pos = this.marker.position; this.select({ lat: typeof pos.lat === 'function' ? pos.lat() : pos.lat, lng: typeof pos.lng === 'function' ? pos.lng() : pos.lng }); }));
        this.status('tap_on_the_map_or_drag_the_pin_to_the_house_entrance'.tr);
      } catch (error) { this.status(error.message); }
    }
    async find() {
      await this.openMap();
      if (!this.geocoder) return;
      const address = this.querySelector('input[type=search]').value.trim();
      if (address.length < 5) return this.status('enter_street_number_and_city_to_search'.tr);
      try {
        const result = await this.geocoder.geocode({ address, region: 'BR' });
        if (!result.results?.[0]) return this.status('address_not_found_use_the_pin_or_gps'.tr);
        const place = result.results[0]; await this.select(place.geometry.location.toJSON(), place.formatted_address);
      } catch { this.status('could_not_search_for_this_address_use_the_pin_or_gps'.tr); }
    }
    clearLocation() {
      this.value = null;
      this.listeners?.forEach(listener => listener?.remove());
      if (this.marker) this.marker.map = null;
      this.marker = null; this.map = null;
      this.querySelector('[data-reference]').value = '';
      const canvas = this.querySelector('[data-canvas]'); canvas.replaceChildren(); canvas.hidden = true;
      this.querySelector('input[type=search]').value = ''; this.status('');
    }
    disconnectedCallback() {
      this.listeners?.forEach((listener) => listener?.remove());
      this.marker?.map && (this.marker.map = null);
      this.map = null; this.marker = null; this.started = false;
    }
  }
  class RouteMap extends HTMLElement {
    connectedCallback() {
      this.innerHTML = '<button type="button" data-origin style="padding:10px;border-radius:20px;border:1px solid #cde5d6;background:white;color:#174b32;font-size:12px;font-weight:bold">Calcular rota a partir do meu GPS</button><div class="cf-location-map" data-map></div><p role="status">Preparando mapa…</p>';
      this.querySelector('[data-origin]').onclick = () => {
        if (!navigator.geolocation) { this.querySelector('p').textContent = 'gps_unavailable_use_external_navigation'.tr; return; }
        navigator.geolocation.getCurrentPosition(({ coords }) => this.draw({ lat: coords.latitude, lng: coords.longitude }), () => { if (this.isConnected) this.querySelector('p').textContent = 'gps_unauthorized_use_external_navigation'.tr; }, { enableHighAccuracy: true, timeout: 12000 });
      };
      this.draw();
    }
    async draw(currentOrigin) {
      this.lines?.forEach((line) => line.setMap(null)); this.markers?.forEach((marker) => { marker.map = null; });
      try {
        const location = JSON.parse(this.getAttribute('destination') || 'null');
        const destination = point(location) || this.getAttribute('address');
        const settings = await config();
        if (!currentOrigin && !settings.originConfigured) throw new Error('set_the_store_location_or_use_the_calculate_route_from_my_gps_button'.tr);
        const googleMaps = await maps();
        const [{ Map }, { Route }] = await Promise.all([googleMaps.importLibrary('maps'), googleMaps.importLibrary('routes')]);
        if (!this.isConnected) return;
        const map = new Map(this.querySelector('[data-map]'), { center: point(location) || settings.storeLocation, zoom: 13, mapId: settings.mapId || 'DEMO_MAP_ID' });
        const result = await Route.computeRoutes({ origin: currentOrigin || point(settings.storeLocation), destination, travelMode: 'DRIVING', routingPreference: 'TRAFFIC_AWARE', fields: ['path', 'distanceMeters', 'durationMillis'] });
        if (!this.isConnected) return;
        const route = result.routes?.[0]; if (!route) throw new Error('route_not_found_open_external_navigation'.tr);
        this.lines = route.createPolylines(); this.lines.forEach((line) => line.setMap(map));
        this.markers = await route.createWaypointAdvancedMarkers(); this.markers.forEach((marker) => { marker.map = map; });
        const bounds = new googleMaps.LatLngBounds(); route.path.forEach((position) => bounds.extend(position)); map.fitBounds(bounds);
        this.querySelector('p').textContent = `${currentOrigin ? 'from_your_gps'.tr : 'from_the_store'.tr} ${'to_the_customer'.tr} ${(Number(route.distanceMeters) / 1000).toFixed(1)} ${'km_about'.tr} ${Math.ceil(Number(route.durationMillis) / 60000)} ${'min_estimate_subject_to_traffic'.tr}`;
      } catch (error) { if (this.isConnected) this.querySelector('p').textContent = (error.message?.startsWith("Configure") ? error.message + ' ' : '') + 'integrated_route_unavailable_use_open_in_google_maps_or_open_in_waze'.tr; }
    }
    disconnectedCallback() { this.lines?.forEach((line) => line.setMap(null)); this.markers?.forEach((marker) => { marker.map = null; }); }
  }
  customElements.define('delivery-location-picker', LocationPicker);
  customElements.define('delivery-route-map', RouteMap);
  async function estimateRoute(location, address) {
    const settings = await config();
    let origin = point(settings.storeLocation);
    if (!settings.originConfigured || !origin) origin = await new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('gps_unavailable'.tr));
      navigator.geolocation.getCurrentPosition(({ coords }) => resolve({ lat: coords.latitude, lng: coords.longitude }), reject, { enableHighAccuracy: true, timeout: 5000, maximumAge: 30000 });
    });
    const googleMaps = await maps();
    const { Route } = await googleMaps.importLibrary('routes');
    const response = await Route.computeRoutes({ origin, destination: point(location) || address, travelMode: 'DRIVING', routingPreference: 'TRAFFIC_AWARE', fields: ['distanceMeters', 'durationMillis'] });
    const route = response.routes?.[0];
    if (!route || !(route.distanceMeters > 0)) throw new Error('route_distance_unavailable'.tr);
    return { distanceMeters: Number(route.distanceMeters), durationSeconds: Number(route.durationMillis) / 1000 };
  }
  window.ConfloraDeliveryMaps = { navigation, estimateRoute };
})();
