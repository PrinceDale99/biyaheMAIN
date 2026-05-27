import 'package:flutter/material.dart';
import 'package:biyahe_app/main.dart'; // For BiyaheTheme
import 'package:biyahe_app/services/places_service.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final TextEditingController _controller = TextEditingController();
  final PlacesService _placesService = PlacesService();
  List<Map<String, dynamic>> _results = [];
  bool _isLoading = false;

  void _onSearchChanged(String query) async {
    if (query.isEmpty) {
      setState(() {
        _results = [];
      });
      return;
    }

    setState(() {
      _isLoading = true;
    });

    final results = await _placesService.getAutocomplete(query);
    setState(() {
      _results = results;
      _isLoading = false;
    });
  }

  void _onResultTapped(String placeId, String description) async {
    final details = await _placesService.getPlaceDetails(placeId);
    if (details != null && details['geometry'] != null) {
      final location = details['geometry']['location'];
      Navigator.of(context).pop({
        'description': description,
        'lat': location['lat'],
        'lng': location['lng']
      });
    } else {
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: BiyaheTheme.bg,
      appBar: AppBar(
        backgroundColor: BiyaheTheme.bg,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: TextField(
          controller: _controller,
          onChanged: _onSearchChanged,
          autofocus: true,
          style: const TextStyle(color: Colors.white),
          decoration: InputDecoration(
            hintText: "Where to, Juan?",
            hintStyle: TextStyle(color: Colors.white.withOpacity(0.5)),
            border: InputBorder.none,
          ),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: BiyaheTheme.primary))
          : ListView.builder(
              itemCount: _results.length,
              itemBuilder: (context, index) {
                final result = _results[index];
                return ListTile(
                  leading: const Icon(Icons.location_on, color: BiyaheTheme.primary),
                  title: Text(result['description'], style: const TextStyle(color: Colors.white)),
                  onTap: () => _onResultTapped(result['place_id'], result['description']),
                );
              },
            ),
    );
  }
}
