/* Shared map controls for catalogue, cashier and delivery drivers. */
(() => {
  let configuration;
  let sdk;
  const config = () => configuration ||= fetch('/api/maps-config').then(async (response) => {
    if (!response.ok) throw new Error('Mapa indisponível. Informe o endereço e use a navegação externa.');
    return response.json();
  }).catch(error => { configuration = null; throw error; });
  const point = (value) => value && value.lat !== null && value.lng !== null && Number.isFinite(Number(value.lat)) && Number.isFinite(Number(value.lng)) && Math.abs(Number(value.lat)) <= 90 && Math.abs(Number(value.lng)) <= 180 ? { lat: Number(value.lat), lng: Number(value.lng) } : null;
  async function maps() {
    const settings = await config();
    if (window.google?.maps?.importLibrary) return window.google.maps;
    if (!settings.apiKey) throw new Error('O mapa ainda não está configurado pela loja. Você pode usar o GPS ou informar o endereço completo.');
    sdk ||= new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const timeout = setTimeout(() => { script.remove(); reject(new Error('O mapa demorou para responder. Use GPS ou endereço.')); }, 20000);
      window.confloraMapsReady = () => { clearTimeout(timeout); resolve(window.google.maps); };
      script.src = 'https://maps.googleapis.com/maps/api/js?' + new URLSearchParams({ key: settings.apiKey, v: 'weekly', loading: 'async', callback: 'confloraMapsReady', language: 'pt-BR', region: 'BR' });
      script.onerror = () => { clearTimeout(timeout); reject(new Error('Não foi possível carregar o mapa. Use GPS ou endereço.')); };
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
      if (point(this.value)) this.status('Localização selecionada. Você pode ajustar o pino no mapa.');
    }
    status(text) { if (this.isConnected) this.querySelector('[data-status]').textContent = text; }
    emit() {
      this.value = { ...this.value, reference: this.querySelector('[data-reference]').value.trim() };
      this.dispatchEvent(new CustomEvent('locationchange', { bubbles: true, detail: this.value }));
    }
    async select(coordinates, address = '') {
      this.value = { ...coordinates, address: address || this.value?.address || this.getAttribute('address') || '' };
      if (this.marker) this.marker.position = coordinates;
      this.map?.panTo(coordinates); this.emit(); this.status('Localização selecionada. Confira o endereço e o ponto de referência.');
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
      if (!navigator.geolocation) return this.status('Seu aparelho não oferece GPS. Busque o endereço no mapa.');
      this.status('Localizando… autorize o GPS no seu navegador.');
      navigator.geolocation.getCurrentPosition(({ coords }) => {
        if (!this.isConnected) return;
        this.select({ lat: coords.latitude, lng: coords.longitude, accuracy: Math.round(coords.accuracy) });
        this.openMap();
      }, () => this.status('Não foi possível usar o GPS. Busque o endereço ou selecione o pino no mapa.'), { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
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
      this.status('Carregando o mapa…'); this.querySelector('[data-map]').setAttribute('aria-busy', 'true');
      try {
        const googleMaps = await maps(); const settings = await config();
        const [{ Map }, { AdvancedMarkerElement }, { Geocoder }] = await Promise.all([googleMaps.importLibrary('maps'), googleMaps.importLibrary('marker'), googleMaps.importLibrary('geocoding')]);
        if (!this.isConnected) return;
        const center = point(this.value) || point(settings.storeLocation) || { lat: -17.5694, lng: -52.5511 };
        const canvas = this.querySelector('[data-canvas]'); canvas.hidden = false;
        this.map = new Map(canvas, { center, zoom: 16, mapId: settings.mapId || 'DEMO_MAP_ID', mapTypeControl: false, streetViewControl: false });
        this.geocoder = new Geocoder();
        this.marker = new AdvancedMarkerElement({ map: this.map, position: center, gmpDraggable: true, title: 'Local de entrega' });
        this.listeners = [this.map.addListener('click', (event) => this.select(event.latLng.toJSON()))];
        this.listeners.push(this.marker.addListener('dragend', () => { const pos = this.marker.position; this.select({ lat: typeof pos.lat === 'function' ? pos.lat() : pos.lat, lng: typeof pos.lng === 'function' ? pos.lng() : pos.lng }); }));
        this.status('Toque no mapa ou arraste o pino até a entrada da casa.');
      } catch (error) { this.status(error.message); }
    }
    async find() {
      await this.openMap();
      if (!this.geocoder) return;
      const address = this.querySelector('input[type=search]').value.trim();
      if (address.length < 5) return this.status('Digite rua, número e cidade para buscar.');
      try {
        const result = await this.geocoder.geocode({ address, region: 'BR' });
        if (!result.results?.[0]) return this.status('Endereço não encontrado. Use o pino ou o GPS.');
        const place = result.results[0]; await this.select(place.geometry.location.toJSON(), place.formatted_address);
      } catch { this.status('Não foi possível buscar este endereço. Use o pino ou o GPS.'); }
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
        if (!navigator.geolocation) { this.querySelector('p').textContent = 'GPS indisponível. Use a navegação externa.'; return; }
        navigator.geolocation.getCurrentPosition(({ coords }) => this.draw({ lat: coords.latitude, lng: coords.longitude }), () => { if (this.isConnected) this.querySelector('p').textContent = 'GPS não autorizado. Use a navegação externa.'; }, { enableHighAccuracy: true, timeout: 12000 });
      };
      this.draw();
    }
    async draw(currentOrigin) {
      this.lines?.forEach((line) => line.setMap(null)); this.markers?.forEach((marker) => { marker.map = null; });
      try {
        const location = JSON.parse(this.getAttribute('destination') || 'null');
        const destination = point(location) || this.getAttribute('address');
        const settings = await config();
        if (!currentOrigin && !settings.originConfigured) throw new Error('Configure a localização da loja ou use o botão Calcular rota a partir do meu GPS.');
        const googleMaps = await maps();
        const [{ Map }, { Route }] = await Promise.all([googleMaps.importLibrary('maps'), googleMaps.importLibrary('routes')]);
        if (!this.isConnected) return;
        const map = new Map(this.querySelector('[data-map]'), { center: point(location) || settings.storeLocation, zoom: 13, mapId: settings.mapId || 'DEMO_MAP_ID' });
        const result = await Route.computeRoutes({ origin: currentOrigin || point(settings.storeLocation), destination, travelMode: 'DRIVING', routingPreference: 'TRAFFIC_AWARE', fields: ['path', 'distanceMeters', 'durationMillis'] });
        if (!this.isConnected) return;
        const route = result.routes?.[0]; if (!route) throw new Error('Rota não encontrada. Abra a navegação externa.');
        this.lines = route.createPolylines(); this.lines.forEach((line) => line.setMap(map));
        this.markers = await route.createWaypointAdvancedMarkers(); this.markers.forEach((marker) => { marker.map = map; });
        const bounds = new googleMaps.LatLngBounds(); route.path.forEach((position) => bounds.extend(position)); map.fitBounds(bounds);
        this.querySelector('p').textContent = `${currentOrigin ? 'Do seu GPS' : 'Da loja'} até o cliente: ${(Number(route.distanceMeters) / 1000).toFixed(1)} km • cerca de ${Math.ceil(Number(route.durationMillis) / 60000)} min. Estimativa sujeita ao trânsito.`;
      } catch (error) { if (this.isConnected) this.querySelector('p').textContent = (error.message?.startsWith('Configure') ? error.message + ' ' : '') + 'Rota integrada indisponível. Use Abrir no Google Maps ou Abrir no Waze.'; }
    }
    disconnectedCallback() { this.lines?.forEach((line) => line.setMap(null)); this.markers?.forEach((marker) => { marker.map = null; }); }
  }
  customElements.define('delivery-location-picker', LocationPicker);
  customElements.define('delivery-route-map', RouteMap);
  window.ConfloraDeliveryMaps = { navigation };
})();
