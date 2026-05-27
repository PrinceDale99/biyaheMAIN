import 'dart:math';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:cloud_firestore/cloud_firestore.dart';

class Waypoint {
  final String name;
  final double lat;
  final double lng;
  final String type; // "pickup", "dropoff", "both", "waypoint", "direct"
  final double fare;

  Waypoint({
    required this.name,
    required this.lat,
    required this.lng,
    required this.type,
    required this.fare,
  });

  factory Waypoint.fromJson(Map<String, dynamic> json) {
    return Waypoint(
      name: json['name'] as String,
      lat: (json['lat'] as num).toDouble(),
      lng: (json['lng'] as num).toDouble(),
      type: json['type'] as String,
      fare: (json['fare'] as num).toDouble(),
    );
  }
}

class TransportInfo {
  final String id;
  final String transportType;
  final String routeName;
  final String terminalName;
  final List<Waypoint> waypoints;
  final List<Map<String, double>> routePath;
  final bool dropOffAnywhere;
  final bool pickUpAnywhere;

  TransportInfo({
    required this.id,
    required this.transportType,
    required this.routeName,
    required this.terminalName,
    required this.waypoints,
    required this.routePath,
    required this.dropOffAnywhere,
    required this.pickUpAnywhere,
  });

  factory TransportInfo.fromFirestore(DocumentSnapshot doc) {
    Map<String, dynamic> data = doc.data() as Map<String, dynamic>;
    var waypointsList = data['waypoints'] as List? ?? [];
    var routePathList = data['routePath'] as List? ?? [];

    return TransportInfo(
      id: doc.id,
      transportType: data['transportType'] ?? '',
      routeName: data['routeName'] ?? '',
      terminalName: data['terminalName'] ?? '',
      waypoints: waypointsList.map((e) => Waypoint.fromJson(e)).toList(),
      routePath: routePathList.map((e) => {'lat': (e['lat'] as num).toDouble(), 'lng': (e['lng'] as num).toDouble()}).toList(),
      dropOffAnywhere: data['dropOffAnywhere'] ?? false,
      pickUpAnywhere: data['pickUpAnywhere'] ?? false,
    );
  }
}

class PathNode {
  final String id;
  final double lat;
  final double lng;
  final String name;
  final String type;
  final String? routeId;

  PathNode({
    required this.id,
    required this.lat,
    required this.lng,
    required this.name,
    required this.type,
    this.routeId,
  });
}

class PathEdge {
  final String from;
  final String to;
  double weight; // Time in seconds
  final double distance; // Meters
  final String type; // "transit", "walk"
  final String? routeId;
  final String? routeName;
  final String? vehicleType;

  PathEdge({
    required this.from,
    required this.to,
    required this.weight,
    required this.distance,
    required this.type,
    this.routeId,
    this.routeName,
    this.vehicleType,
  });
}

class PathResultNode {
  final PathNode node;
  final PathEdge? edge;

  PathResultNode({required this.node, this.edge});
}

class PathResult {
  final double totalTime;
  final double totalDistance;
  final List<PathResultNode> path;

  PathResult({
    required this.totalTime,
    required this.totalDistance,
    required this.path,
  });
}

class Pathfinder {
  static double haversine(double lat1, double lon1, double lat2, double lon2) {
    const R = 6371000; // Meters
    final dLat = (lat2 - lat1) * pi / 180;
    final dLon = (lon2 - lon1) * pi / 180;
    final a = sin(dLat / 2) * sin(dLat / 2) +
        cos(lat1 * pi / 180) * cos(lat2 * pi / 180) *
        sin(dLon / 2) * sin(dLon / 2);
    final c = 2 * atan2(sqrt(a), sqrt(1 - a));
    return R * c;
  }

  static double getAvgSpeed(String type) {
    switch (type.toLowerCase()) {
      case "jeep": return 15 / 3.6; // 15 km/h -> m/s
      case "uv express": return 25 / 3.6;
      case "bus": return 20 / 3.6;
      case "lrt/mrt": return 35 / 3.6;
      case "trike": return 12 / 3.6;
      case "walk": return 4 / 3.6; // 4 km/h
      case "stairs": return 1.5 / 3.6; // Much slower
      case "footbridge": return 3.5 / 3.6; 
      case "overpass": return 3 / 3.6; // Slower due to elevation
      case "pedestrian_lane": return 4 / 3.6;
      default: return 15 / 3.6;
    }
  }

  static Future<PathResult?> findOptimalRoute({
    required Map<String, double> origin,
    required Map<String, double> destination,
    List<TransportInfo>? data,
  }) async {
    List<TransportInfo> transportData = data ?? [];
    if (transportData.isEmpty) {
      try {
        final querySnapshot = await FirebaseFirestore.instance.collection("transport_info").get();
        transportData = querySnapshot.docs.map((doc) => TransportInfo.fromFirestore(doc)).toList();
      } catch (e) {
        print("Error fetching transport info: $e");
        return null; // Return null if Firebase is not connected
      }
    }

    final Map<String, PathNode> nodes = {};
    final List<PathEdge> edges = [];

    nodes["origin"] = PathNode(id: "origin", lat: origin['lat']!, lng: origin['lng']!, name: "Current Location", type: "origin");
    nodes["destination"] = PathNode(id: "destination", lat: destination['lat']!, lng: destination['lng']!, name: "Destination", type: "destination");

    for (var route in transportData) {
      for (var idx = 0; idx < route.waypoints.length; idx++) {
        var wp = route.waypoints[idx];
        String nodeId = "${route.id}-wp-$idx";
        nodes[nodeId] = PathNode(
          id: nodeId,
          lat: wp.lat,
          lng: wp.lng,
          name: wp.name,
          type: wp.type,
          routeId: route.id,
        );

        if (idx > 0) {
          String prevNodeId = "${route.id}-wp-${idx - 1}";
          double dist = haversine(route.waypoints[idx - 1].lat, route.waypoints[idx - 1].lng, wp.lat, wp.lng);
          double speed = getAvgSpeed(route.transportType);
          
          edges.add(PathEdge(
            from: prevNodeId,
            to: nodeId,
            weight: dist / speed,
            distance: dist,
            type: "transit",
            routeId: route.id,
            routeName: route.routeName,
            vehicleType: route.transportType,
          ));

          edges.add(PathEdge(
            from: nodeId,
            to: prevNodeId,
            weight: dist / speed,
            distance: dist,
            type: "transit",
            routeId: route.id,
            routeName: route.routeName,
            vehicleType: route.transportType,
          ));
        }
      }
    }

    final allNodes = nodes.values.toList();
    for (var node in allNodes) {
      if (node.id == "origin" || node.id == "destination") continue;
      
      const double maxWalkToTransit = 2000;
      const double maxWalkTransfer = 400;

      if (node.type == "pickup" || node.type == "both") {
        double dist = haversine(origin['lat']!, origin['lng']!, node.lat, node.lng);
        if (dist < maxWalkToTransit) {
          edges.add(PathEdge(
            from: "origin",
            to: node.id,
            weight: dist / getAvgSpeed("walk"),
            distance: dist,
            type: "walk",
          ));
        }
      }

      if (node.type == "dropoff" || node.type == "both") {
        double dist = haversine(destination['lat']!, destination['lng']!, node.lat, node.lng);
        if (dist < maxWalkToTransit) {
          edges.add(PathEdge(
            from: node.id,
            to: "destination",
            weight: dist / getAvgSpeed("walk"),
            distance: dist,
            type: "walk",
          ));
        }
      }

      for (var otherNode in allNodes) {
        if (node.id == otherNode.id || node.routeId == otherNode.routeId) continue;
        if (node.id == "origin" || node.id == "destination" || otherNode.id == "origin" || otherNode.id == "destination") continue;

        double dist = haversine(node.lat, node.lng, otherNode.lat, otherNode.lng);
        if (dist < maxWalkTransfer) {
          // Calculate speed and safety based on infrastructure type
          double speed = getAvgSpeed("walk");
          double safety = 0.5;

          if (node.type == "stairs" || otherNode.type == "stairs") speed = getAvgSpeed("stairs");
          if (node.type == "footbridge" || otherNode.type == "footbridge") {
            speed = getAvgSpeed("footbridge");
            safety = 0.9;
          }
          if (node.type == "overpass" || otherNode.type == "overpass") {
            speed = getAvgSpeed("overpass");
            safety = 0.95;
          }
          if (node.type == "pedestrian_lane" || otherNode.type == "pedestrian_lane") safety = 0.8;

          double baseWeight = dist / speed;
          double safetyPenalty = (1 - safety) * 120; // Up to 2 mins penalty for unsafe routes

          edges.add(PathEdge(
            from: node.id,
            to: otherNode.id,
            weight: baseWeight + safetyPenalty + 60, // 1 min fixed transfer overhead
            distance: dist,
            type: "walk",
          ));
        }
      }

      if (node.type == "direct") {
        for (var e in edges) {
          if ((e.to == node.id || e.from == node.id) && e.type == "walk") {
            e.weight *= 0.7; // 30% Shortcut Bonus for Iskinitas/Footbridges
          }
        }
      }
    }

    return dijkstra(nodes, edges, "origin", "destination");
  }

  static PathResult? dijkstra(Map<String, PathNode> nodes, List<PathEdge> edges, String start, String end) {
    Map<String, double> distances = {};
    Map<String, Map<String, dynamic>?> previous = {};
    Set<String> queue = {};

    for (var id in nodes.keys) {
      distances[id] = double.infinity;
      previous[id] = null;
      queue.add(id);
    }

    distances[start] = 0;

    while (queue.isNotEmpty) {
      String? minNode;
      for (var id in queue) {
        if (minNode == null || distances[id]! < distances[minNode]!) {
          minNode = id;
        }
      }

      if (minNode == null || distances[minNode] == double.infinity || minNode == end) break;

      queue.remove(minNode);

      var neighbors = edges.where((e) => e.from == minNode).toList();
      for (var edge in neighbors) {
        double alt = distances[minNode]! + edge.weight;
        if (alt < distances[edge.to]!) {
          distances[edge.to] = alt;
          previous[edge.to] = {'nodeId': minNode, 'edge': edge};
        }
      }
    }

    List<PathResultNode> path = [];
    String? curr = end;
    if (previous[end] == null) return null;

    while (curr != null) {
      var prevInfo = previous[curr];
      path.insert(0, PathResultNode(node: nodes[curr]!, edge: prevInfo?['edge'] as PathEdge?));
      curr = prevInfo?['nodeId'] as String?;
    }

    double totalDistance = path.fold(0.0, (acc, p) => acc + (p.edge?.distance ?? 0.0));

    return PathResult(
      totalTime: distances[end]!,
      totalDistance: totalDistance,
      path: path,
    );
  }
}
