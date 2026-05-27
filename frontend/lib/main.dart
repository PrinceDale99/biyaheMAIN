import 'package:flutter/material.dart';
import 'dart:ui';
import 'package:biyahe_app/screens/navigation_screen.dart';
import 'package:biyahe_app/screens/search_screen.dart';
import 'package:biyahe_app/screens/auth/login_screen.dart';
import 'package:biyahe_app/screens/chat_screen.dart';
import 'package:biyahe_app/screens/rewards_screen.dart';
import 'package:biyahe_app/services/auth_service.dart';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:provider/provider.dart';
import 'package:shorebird_code_push/shorebird_code_push.dart';

final shorebirdCodePush = ShorebirdCodePush();

// PRODUCTION READY: Centralized Theme & Constants
class BiyaheTheme {
  static const Color primary = Color(0xFF14B8A6); // Teal 500
  static const Color bg = Color(0xFF0F172A);      // Slate 900
  static const Color card = Color(0xFF1E293B);    // Slate 800
  static const Color accent = Color(0xFF2DD4BF);  // Teal 400
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  MapboxOptions.setAccessToken(const String.fromEnvironment("MAPBOX_ACCESS_TOKEN", defaultValue: "YOUR_MAPBOX_ACCESS_TOKEN_HERE"));

  // Check for updates over-the-air
  shorebirdCodePush.checkForUpdate().then((status) {
    if (status == UpdateStatus.restartRequired) {
      debugPrint("Biyahe: New update downloaded. It will be applied on next restart.");
    }
  });

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthService()),
      ],
      child: const BiyaheApp(),
    ),
  );
}

class BiyaheApp extends StatelessWidget {
  const BiyaheApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'B.I.Y.A.H.E. PH',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: BiyaheTheme.bg,
        primaryColor: BiyaheTheme.primary,
        fontFamily: 'Inter',
        useMaterial3: true,
      ),
      home: const BiyaheHomeScreen(),
    );
  }
}

class BiyaheHomeScreen extends StatefulWidget {
  const BiyaheHomeScreen({super.key});

  @override
  State<BiyaheHomeScreen> createState() => _BiyaheHomeScreenState();
}

class _BiyaheHomeScreenState extends State<BiyaheHomeScreen> {
  MapboxMap? mapboxMap;
  PointAnnotationManager? pointAnnotationManager;
  Point? userLocation;
  String _destinationName = 'Where to, Juan?...';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // 1. MAPBOX LAYER
          _buildMapboxLayer(),

          // 2. SEARCH BAR & PROFILE (Glassmorphic)
          Positioned(
            top: MediaQuery.of(context).padding.top + 16,
            left: 16,
            right: 16,
            child: _buildHeader(),
          ),

          // 3. ROUTE STATUS PANEL (Mobile Responsive Layout)
          Positioned(
            bottom: 100,
            left: 16,
            right: 16,
            child: _buildRoutePanel(),
          ),

          // 4. BOTTOM NAV
          _buildBottomNav(),
        ],
      ),
    );
  }

  Widget _buildMapboxLayer() {
    return MapWidget(
      key: const ValueKey("mapWidget"),
      styleUri: "mapbox://styles/mapbox/dark-v11",
      onMapCreated: _onMapCreated,
    );
  }

  void _onMapCreated(MapboxMap mapboxMap) async {
    this.mapboxMap = mapboxMap;
    // Enable 3D terrain and building extrusions
    mapboxMap.setTerrain(Terrain(sourceId: "mapbox-dem", exaggeration: 1.5));
    
    mapboxMap.location.updateSettings(LocationComponentSettings(
      enabled: true,
      pulsingEnabled: true,
      puckBearingEnabled: true,
    ));
    
    // Set initial camera
    mapboxMap.setCamera(CameraOptions(
      center: Point(coordinates: Position(120.9842, 14.5995)),
      zoom: 14.0,
      pitch: 60.0,
    ));

    pointAnnotationManager = await mapboxMap.annotations.createPointAnnotationManager();
  }

  Widget _buildHeader() {
    return Consumer<AuthService>(
      builder: (context, authService, child) {
        return GestureDetector(
          onTap: () async {
            final result = await Navigator.of(context).push(
              MaterialPageRoute(builder: (context) => const SearchScreen()),
            );
            if (result != null && result is Map<String, dynamic>) {
              setState(() {
                _destinationName = result['description'] ?? 'Destination';
              });
              if (mapboxMap != null && pointAnnotationManager != null && result['lat'] != null && result['lng'] != null) {
                final targetPoint = Point(coordinates: Position(result['lng'], result['lat']));
                mapboxMap?.flyTo(
                  CameraOptions(
                    center: targetPoint,
                    zoom: 16.0,
                    pitch: 60.0,
                  ),
                  MapAnimationOptions(duration: 2000),
                );
                
                pointAnnotationManager?.deleteAll();
                pointAnnotationManager?.create(PointAnnotationOptions(
                  geometry: targetPoint,
                ));
              }
            }
          },
          child: ClipRRect(
            borderRadius: BorderRadius.circular(24),
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 15, sigmaY: 15),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.05),
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: Colors.white.withOpacity(0.1)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.location_on, color: BiyaheTheme.primary, size: 20),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        _destinationName,
                        style: const TextStyle(color: Colors.white38, fontSize: 14, fontWeight: FontWeight.w500),
                      ),
                    ),
                    const VerticalDivider(color: Colors.white10, width: 24),
                    const Icon(Icons.mic, color: Colors.white38, size: 20),
                    const SizedBox(width: 12),
                    GestureDetector(
                      onTap: () {
                        if (!authService.isAuthenticated) {
                          Navigator.of(context).push(MaterialPageRoute(builder: (context) => const LoginScreen()));
                        }
                      },
                      child: CircleAvatar(
                        radius: 18,
                        backgroundColor: BiyaheTheme.primary.withOpacity(0.2),
                        backgroundImage: authService.isAuthenticated && authService.userProfile?.photoUrl != null 
                          ? NetworkImage(authService.userProfile!.photoUrl!) 
                          : const NetworkImage('https://i.pravatar.cc/150?u=juan'),
                        child: !authService.isAuthenticated ? const Icon(Icons.person, color: Colors.white54, size: 20) : null,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      }
    );
  }

  Widget _buildRoutePanel() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Journey Info Card
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: BiyaheTheme.card.withOpacity(0.9),
            borderRadius: BorderRadius.circular(28),
            border: Border.all(color: Colors.white.withOpacity(0.05)),
            boxShadow: [
              BoxShadow(color: Colors.black.withOpacity(0.3), blurRadius: 20, offset: const Offset(0, 10)),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('LRT-1 → MRT-3', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(color: Colors.green.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
                    child: const Text('PROD_READY', style: TextStyle(color: Colors.green, fontSize: 10, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              _buildStep(Icons.train_outlined, 'Board at Doroteo Jose', 'LRT-1 Southbound'),
              const Padding(padding: EdgeInsets.only(left: 11), child: SizedBox(height: 12, child: VerticalDivider(color: Colors.white10))),
              _buildStep(Icons.transfer_within_a_station, 'Transfer at Taft Ave.', '4 min walk to MRT-3'),
              const SizedBox(height: 20),
              Row(
                children: [
                  const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('EST. FARE', style: TextStyle(color: Colors.white38, fontSize: 10, fontWeight: FontWeight.bold)),
                      Text('PHP 45.00', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: BiyaheTheme.primary)),
                    ],
                  ),
                  const Spacer(),
                  ElevatedButton(
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (context) => const NavigationScreen(
                            coordinates: [
                              [120.9842, 14.5995],
                              [120.9850, 14.6010],
                              [120.9865, 14.6030],
                            ],
                          ),
                        ),
                      );
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: BiyaheTheme.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      elevation: 8,
                      shadowColor: BiyaheTheme.primary.withOpacity(0.4),
                    ),
                    child: const Text('START', style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildStep(IconData icon, String title, String sub) {
    return Row(
      children: [
        Icon(icon, size: 22, color: BiyaheTheme.primary),
        const SizedBox(width: 16),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
            Text(sub, style: const TextStyle(color: Colors.white38, fontSize: 12)),
          ],
        ),
      ],
    );
  }

  Widget _buildBottomNav() {
    return Align(
      alignment: Alignment.bottomCenter,
      child: Container(
        height: 80,
        padding: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: BiyaheTheme.bg,
          border: Border(top: BorderSide(color: Colors.white.withOpacity(0.05))),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _buildNavItem(Icons.map, 'Map', true, () {}),
            _buildNavItem(Icons.chat_bubble_outline, 'Assistant', false, () {
              Navigator.of(context).push(MaterialPageRoute(builder: (context) => const ChatScreen()));
            }),
            _buildNavItem(Icons.stars_outlined, 'Rewards', false, () {
              Navigator.of(context).push(MaterialPageRoute(builder: (context) => const RewardsScreen()));
            }),
            _buildNavItem(Icons.person_outline, 'Profile', false, () {
              final authService = Provider.of<AuthService>(context, listen: false);
              if (!authService.isAuthenticated) {
                Navigator.of(context).push(MaterialPageRoute(builder: (context) => const LoginScreen()));
              } else {
                ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Logged in as \${authService.userProfile?.email}')));
              }
            }),
          ],
        ),
      ),
    );
  }

  Widget _buildNavItem(IconData icon, String label, bool active, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, color: active ? BiyaheTheme.primary : Colors.white24, size: 24),
          const SizedBox(height: 4),
          Text(label, style: TextStyle(color: active ? BiyaheTheme.primary : Colors.white24, fontSize: 10, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}

