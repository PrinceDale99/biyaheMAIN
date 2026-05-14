class TransitRoute {
  final String id;
  final String name;
  final String color;
  final List<String> stops;

  TransitRoute({
    required this.id,
    required this.name,
    required this.color,
    required this.stops,
  });

  factory TransitRoute.fromJson(Map<String, dynamic> json) {
    return TransitRoute(
      id: json['id'],
      name: json['name'],
      color: json['color'],
      stops: List<String>.from(json['stops']),
    );
  }
}

class Journey {
  final int arrivalTime;
  final double cost;
  final int transfers;
  final double walkDist;

  Journey({
    required this.arrivalTime,
    required this.cost,
    required this.transfers,
    required this.walkDist,
  });

  factory Journey.fromJson(Map<String, dynamic> json) {
    return Journey(
      arrivalTime: json['arrival'],
      cost: json['cost'].toDouble(),
      transfers: json['transfers'],
      walkDist: json['walk'].toDouble(),
    );
  }
}
