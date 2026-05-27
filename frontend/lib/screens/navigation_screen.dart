import 'package:flutter/material.dart';
import 'package:mapbox_navigation/mapbox_navigation.dart';

class NavigationScreen extends StatefulWidget {
  final List<List<double>> coordinates; // [lng, lat]

  const NavigationScreen({super.key, required this.coordinates});

  @override
  State<NavigationScreen> createState() => _NavigationScreenState();
}

class _NavigationScreenState extends State<NavigationScreen> {
  MapBoxNavigation? _directions;
  MapBoxOptions? _options;
  bool _isNavigating = false;

  @override
  void initState() {
    super.initState();
    _initialize();
  }

  Future<void> _initialize() async {
    _directions = MapBoxNavigation(onRouteEvent: _onEmbeddedRouteEvent);
    
    _options = MapBoxOptions(
      initialLatitude: widget.coordinates[0][1],
      initialLongitude: widget.coordinates[0][0],
      zoom: 18.0,
      tilt: 60.0,
      bearing: 0.0,
      enableRefresh: true, // Crucial for accurate ETA updates
      alternatives: true,
      voiceInstructionsEnabled: true,
      bannerInstructionsEnabled: true,
      allowsUTurnAtWayPoints: true,
      mode: MapBoxNavigationMode.drivingWithTraffic, // Defaulting to traffic-aware for best ETA
      units: MapBoxUnits.metric,
      simulateRoute: false,
      language: "en",
    );
  }

  Future<void> _onEmbeddedRouteEvent(e) async {
    if (e.eventType == MapBoxEvent.navigation_finished) {
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final wayPoints = widget.coordinates.map((c) => WayPoint(
      name: "Node",
      latitude: c[1],
      longitude: c[0],
    )).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Navigation'),
        backgroundColor: const Color(0xFF0F172A),
      ),
      body: Center(
        child: Container(
          color: const Color(0xFF0F172A),
          child: MapBoxNavigationView(
            options: _options,
            onRouteEvent: _onEmbeddedRouteEvent,
            onCreated: (controller) async {
              await _directions?.startNavigation(
                wayPoints: wayPoints,
                options: _options!,
              );
            },
          ),
        ),
      ),
    );
  }
}
