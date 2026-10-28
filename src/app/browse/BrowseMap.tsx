"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import { LocateFixed, RotateCw } from "lucide-react";
import { Button } from "@/components/ui";
import "leaflet/dist/leaflet.css";
import LocationCard from "./LocationCard";
import type { Location } from "./BrowseClient";
import { facilityCoordinates, type MapBounds } from "./browsePresentation";
import styles from "./BrowseMap.module.css";

export interface BrowseMapProps {
  locations: Location[]; selectedId: string | null; onSelect: (id: string) => void;
  origin?: { latitude: number; longitude: number; approximate: boolean };
  onSearchArea: (bounds: MapBounds) => void; onNavigate: () => void; resetKey: string; loading: boolean;
  hasMore?: boolean; onLoadMore?: () => void; loadingMore?: boolean; error?: string | null; onRetry?: () => void;
}

export default function BrowseMap(props: BrowseMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const selection = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layers = useRef<LayerGroup | null>(null);
  const current = useRef(props);
  const fitted = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [viewport, setViewport] = useState<MapBounds | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => { current.current = props; });

  useEffect(() => {
    let disposed = false;
    void import("leaflet").then(L => {
      if (disposed || !container.current) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const instance = L.map(container.current, { zoomControl: false, scrollWheelZoom: false, keyboardPanDelta: 24, zoomAnimation: !reduced, fadeAnimation: !reduced, markerZoomAnimation: !reduced, minZoom: 2, maxZoom: 19 });
      map.current = instance;
      instance.attributionControl.setPrefix(false);
      L.control.zoom({ position: "topright", zoomInTitle: "Zoom in", zoomOutTitle: "Zoom out" }).addTo(instance);
      const tileUrl = process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
      const provider = process.env.NEXT_PUBLIC_MAP_TILE_CREDIT || "";
      const credit = document.createElement("span");
      credit.textContent = provider;
      let loaded = 0, errors = 0;
      L.tileLayer(tileUrl, { maxZoom: 19, keepBuffer: 1, referrerPolicy: "strict-origin-when-cross-origin", attribution: credit.innerHTML + ' &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>' })
        .on("tileload", () => { loaded++; setTilesFailed(false); })
        .on("tileerror", () => { errors++; if (!loaded) setTilesFailed(true); })
        .on("loading", () => { loaded = 0; errors = 0; })
        .on("load", () => setTilesFailed(loaded === 0 && errors > 0)).addTo(instance);
      layers.current = L.layerGroup().addTo(instance);
      instance.on("moveend", () => {
        const bounds = instance.getBounds();
        const west = bounds.getWest(), east = bounds.getEast();
        const wrap = (value: number) => ((value + 180) % 360 + 360) % 360 - 180;
        setViewport([Math.max(-90, bounds.getSouth()), east - west >= 360 ? -180 : wrap(west), Math.min(90, bounds.getNorth()), east - west >= 360 ? 180 : wrap(east)]);
      });
      instance.setView([20.6, 78.9], 5);
      const resize = new ResizeObserver(() => instance.invalidateSize({ pan: false }));
      resize.observe(container.current);
      instance.on("unload", () => resize.disconnect());
      fitted.current = null;
      setReady(true);
    }).catch(() => { if (!disposed) setFailed(true); });
    return () => { disposed = true; map.current?.remove(); map.current = null; layers.current = null; };
  }, [retry]);

  useEffect(() => {
    if (!ready || !map.current || !layers.current) return;
    let disposed = false;
    let detachVisibility = () => {};
    void import("leaflet").then(L => {
      if (disposed || !map.current || !layers.current) return;
      const instance = map.current;
      // Keep a whole touch target visible; clipped/covered pins remain available in List.
      const syncVisibility = () => {
        const canvas = container.current;
        const section = canvas?.parentElement;
        if (!canvas || !section) return;
        const frame = canvas.getBoundingClientRect();
        const overlays = [...section.querySelectorAll<HTMLElement>([styles.selection, styles.searchArea, styles.locate, styles.mapNotices, styles.unmapped, styles.noPins].map(value => "." + value).join(",") + ",.leaflet-control")].map(node => node.getBoundingClientRect()).filter(box => box.width > 0 && box.height > 0);
        for (const button of canvas.querySelectorAll<HTMLButtonElement>("button[data-map-pin]")) {
          const box = button.getBoundingClientRect();
          const outside = box.left < frame.left + 2 || box.right > frame.right - 2 || box.top < frame.top + 2 || box.bottom > frame.bottom - 2 || overlays.some(overlay => box.left < overlay.right && box.right > overlay.left && box.top < overlay.bottom && box.bottom > overlay.top);
          button.dataset.outside = String(outside);
          button.disabled = outside;
          button.tabIndex = outside ? -1 : 0;
          if (outside) button.setAttribute("aria-hidden", "true"); else button.removeAttribute("aria-hidden");
        }
      };
      instance.on("moveend zoomend resize", syncVisibility);
      detachVisibility = () => instance.off("moveend zoomend resize", syncVisibility);
      const selectionTop = selection.current && container.current ? selection.current.getBoundingClientRect().top - container.current.getBoundingClientRect().top : null;
      const bottomPadding = Math.min(selectionTop === null ? 48 : instance.getSize().y - selectionTop + 16, Math.max(48, instance.getSize().y - 104));
      layers.current.clearLayers();
      const points: [number, number][] = [];
      props.locations.forEach((location, index) => {
        const coordinates = facilityCoordinates(location);
        if (!coordinates) return;
        points.push(coordinates);
        const button = document.createElement("button");
        button.type = "button";
        button.className = styles.pin;
        button.dataset.mapPin = "true";
        button.dataset.selected = String(location.id === props.selectedId);
        button.setAttribute("aria-label", `Select ${location.name}, location ${index + 1}`);
        button.setAttribute("aria-pressed", String(location.id === props.selectedId));
        const number = document.createElement("span");
        number.textContent = String(index + 1);
        button.append(number);
        L.marker(coordinates, { keyboard: false, zIndexOffset: location.id === props.selectedId ? 1000 : 0, icon: L.divIcon({ html: button, className: styles.pinHost, iconSize: [44, 44], iconAnchor: [22, 22] }) }).on("click", () => current.current.onSelect(location.id)).addTo(layers.current!);
      });
      if (props.origin) L.circleMarker([props.origin.latitude, props.origin.longitude], { radius: 6, color: "#ffffff", weight: 3, fillColor: "#2778e9", fillOpacity: 1 }).bindTooltip(props.origin.approximate ? "Your approximate location" : "Your location").addTo(layers.current);
      if (fitted.current !== props.resetKey && (points.length || props.origin)) {
        fitted.current = props.resetKey;
        if (points.length) {
          const area = L.latLngBounds(points);
          instance.fitBounds(area, { paddingTopLeft: [36, 60], paddingBottomRight: [36, bottomPadding], maxZoom: 14, animate: false });
          // A short phone's details card must not compress nearby pins into one untappable group.
          if (area.getNorth() - area.getSouth() < .5 && area.getEast() - area.getWest() < .5 && instance.getZoom() < 12) instance.setZoom(12, { animate: false });
        }
        else if (props.origin) instance.setView([props.origin.latitude, props.origin.longitude], 12);
      }
      const selected = props.locations.find(location => location.id === props.selectedId);
      const point = selected && facilityCoordinates(selected);
      if (point) {
        const pixel = instance.latLngToContainerPoint(point);
        const target = L.point(instance.getSize().x / 2, Math.max(90, (64 + (selectionTop ?? instance.getSize().y - 48)) / 2));
        instance.panBy(pixel.subtract(target), { animate: false });
      }
      syncVisibility();
    });
    return () => { disposed = true; detachVisibility(); };
  }, [ready, props.locations, props.selectedId, props.origin, props.resetKey, props.error, props.hasMore, tilesFailed]);

  const selected = props.locations.find(location => location.id === props.selectedId && facilityCoordinates(location)) || props.locations.find(location => facilityCoordinates(location));
  const mapped = props.locations.filter(location => facilityCoordinates(location)).length;
  return <section className={styles.map} aria-label="Map of healthcare locations" aria-describedby="browse-map-help">
    <p id="browse-map-help" className="sr-only">Use arrow keys to move the map and plus or minus to zoom. Numbered buttons select facilities. Use List view for all results, including facilities without map coordinates.</p>
    <div ref={container} className={styles.canvas} role="group" aria-label="Interactive facility map" />
    {!ready && !failed && <div className={styles.loading} role="status">Loading map…</div>}
    {failed && <div className={styles.loading} role="alert">The map could not load.<Button variant="outline" onClick={() => { setFailed(false); setReady(false); setRetry(value => value + 1); }}>Try again</Button></div>}
    {ready && <>
      <Button variant="outline" className={styles.searchArea + " min-h-11!"} disabled={!viewport || props.loading} onClick={() => viewport && props.onSearchArea(viewport)} icon={<RotateCw aria-hidden="true" />}>{props.loading ? "Searching…" : "Search this area"}</Button>
      <div className={styles.mapNotices}>
        {props.error && <p role="alert">Results could not be updated. Showing previous locations. <Button variant="ghost" size="sm" onClick={props.onRetry}>Try again</Button></p>}
        {props.hasMore && <Button variant="outline" onClick={props.onLoadMore} disabled={props.loadingMore || props.loading}>{props.loadingMore ? "Loading…" : "Load more locations"}</Button>}
        {tilesFailed && <p role="status">Map imagery is unavailable. Facility pins and List view still work.</p>}
      </div>
      {props.origin && <Button variant="outline" className={styles.locate + " min-h-11!"} aria-label={props.origin.approximate ? "Center on your approximate location" : "Center on your location"} onClick={() => props.origin && map.current?.setView([props.origin.latitude, props.origin.longitude], 13, { animate: false })} icon={<LocateFixed aria-hidden="true" />} />}
      {mapped > 0 && mapped < props.locations.length && <p className={styles.unmapped}>{mapped} of {props.locations.length} locations have map pins. Others remain in List view.</p>}
      {!mapped && !props.loading && <p className={styles.noPins} role="status">{props.locations.length ? "These facilities have no saved map coordinates." : "No facilities found in this area. Move the map or change your filters."}</p>}
    </>}
    {selected && <div ref={selection} className={styles.selection} aria-live="polite"><LocationCard location={selected} variant="summary" selected onNavigate={props.onNavigate} showDistance={false} approximateDistance={false} /></div>}
  </section>;
}
