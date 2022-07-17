

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { useParams } from 'react-router-dom';
import NoMatch from './NoMatch';
import TitleBar from '../components/TitleBar';
import LoadingScreen from '../components/LoadingScreen';
import TransitMap from '../components/TransitMap';
import TripTable from '../components/TripTable';
import Footer from '../components/Footer';
import { getJSON, formatPositionData, formatShapePoints } from './../util.js';
import AlertList from '../components/AlertList';
import DataFetchError from '../components/DataFetchError';
import TransitRouteHeader from '../components/TransitRouteHeader';

const GTFS_BASE_URL = process.env.REACT_APP_GTFS_BASE_URL;
const REFRESH_VEHICLE_POSITIONS_TTL = 7000;

function TransitRoute() {
  const [route, setRouteData] = useState({});
  const [routeTrips, setRouteTripsData] = useState([]);
  const [routeStops, setRouteStops] = useState([]);
  const [routeShapes, setRouteShapes] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [agencies, setAgencyData] = useState([]);
  const [vehicleMarkers, setVehicleMarkers] = useState([]);
  const [isRouteLoaded, setRouteLoaded] = useState(false);
  const [isRouteStopsLoaded, setRouteStopsLoaded] = useState(false);
  const [isRouteShapesLoaded, setRouteShapesLoaded] = useState(false);
  const [isRouteTripsLoaded, setRouteTripsLoaded] = useState(false);
  const [isAlertLoaded, setAlertLoaded] = useState(false);
  const [isAgencyLoaded, setAgencyLoaded] = useState(false);
  const [isVehiclePositionLoaded, setVehiclePositionLoaded] = useState(false);
  const [dataFetchError, setDataFetchError] = useState(false);
  const params = useParams();
  const map = useRef(null);

  // Consolidated check that things are ready to go
  const isUIReady = [isRouteLoaded, isRouteTripsLoaded, isRouteStopsLoaded, isRouteShapesLoaded, isAlertLoaded, isAgencyLoaded, isVehiclePositionLoaded].every((a) => a === true);

  useEffect(() => {
    getJSON(GTFS_BASE_URL + '/routes/' + params.route_id + '.json')
      .then((r) => setRouteData(r))
      .then(() => setRouteLoaded(true))
      .catch((error) => setDataFetchError(error));

    getJSON(GTFS_BASE_URL + '/routes/' + params.route_id + '/stops.json?per_page=200')
      .then((rs) => setRouteStops(rs.data))
      .then(() => setRouteStopsLoaded(true))
      .catch((error) => setDataFetchError(error));

     getJSON(GTFS_BASE_URL + '/routes/' + params.route_id + '/shapes.json')
      .then((rs) => setRouteShapes(rs.data))
      .then(() => setRouteShapesLoaded(true))
      .catch((error) => setDataFetchError(error));

    getJSON(GTFS_BASE_URL + '/routes/' + params.route_id + '/trips.json?per_page=500')
      .then((r) => setRouteTripsData(r.data))
      .then(() => setRouteTripsLoaded(true))
      .catch((error) => setDataFetchError(error));

    getJSON(GTFS_BASE_URL + '/agencies.json')
      .then((a) => setAgencyData(a.data))
      .then(() => setAgencyLoaded(true))
      .catch((error) => setDataFetchError(error));

    getJSON(GTFS_BASE_URL + '/realtime/alerts.json')
      .then((data) => setAlerts(data))
      .then(() => setAlertLoaded(true))
      .catch((error) => setDataFetchError(error));

    getJSON(GTFS_BASE_URL + '/realtime/vehicle_positions.json')
      .then(function (data) {
        data = data.filter(v => v.vehicle.trip.route_id === params.route_id);
        return formatPositionData(data);
      })
      .then((data) => setVehicleMarkers(data))
      .then(() => setVehiclePositionLoaded(true))
      .catch((error) => setDataFetchError(error));

    // Refresh position data at set interval
    const refreshPositionsInterval = setInterval(() => {
      if (!isUIReady) {
        return;
      }
      getJSON(GTFS_BASE_URL + '/realtime/vehicle_positions.json')
        .then(function (data) {
          data = data.filter(v => v.vehicle.trip.route_id === params.route_id);
          return formatPositionData(data);
        })
        .then((data) => setVehicleMarkers(data))
        .catch((error) => setDataFetchError(error));
    }, REFRESH_VEHICLE_POSITIONS_TTL);

    // Run on unmount
    return () => {
      clearInterval(refreshPositionsInterval);
    };
  }, [params.route_id, isUIReady]);

  if (dataFetchError) {
    return(<DataFetchError error={dataFetchError}></DataFetchError>);
  }

  if (!isUIReady) {
    return(<LoadingScreen></LoadingScreen>);
  }

  // No matching route
  if (!route || route.status === 404) {
    return(<NoMatch></NoMatch>);
  }

  const routeAlerts = alerts.filter((a) => a.alert.informed_entity[0].route_id === route.route_short_name);

  // Nest stops for map compatibility
  const mapStops = [];
  routeStops.map((s) => mapStops.push({id: s.id, stop: s}));

  // Add route color to shapes
  routeShapes.map((s) => s.route_color = route.route_color);

  // Set the map to center on the trip route
  const getPolyLineBounds = L.latLngBounds(formatShapePoints(routeShapes[0].points));
  const center = getPolyLineBounds.getCenter();

  return(
    <div>
      <TitleBar></TitleBar>
      <div className="container transit-route">
        <TransitRouteHeader route={route} alerts={routeAlerts} showRouteType={true}></TransitRouteHeader>
        <TransitMap vehicleMarkers={vehicleMarkers} routes={[route]} agencies={agencies} routeShapes={routeShapes} routeStops={mapStops} alerts={routeAlerts} map={map} center={[center.lat, center.lng]} zoom={13}></TransitMap>
        <AlertList alerts={routeAlerts} routes={[route]}></AlertList>
        <TripTable route={route} routeTrips={routeTrips}></TripTable>
      </div>
      <Footer></Footer>
    </div>
  );
}

export default TransitRoute;
