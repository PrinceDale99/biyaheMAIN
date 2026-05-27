import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';

class UserProfile {
  final String uid;
  final String email;
  final String? displayName;
  final String? photoUrl;
  final int reputation;
  final double stellarPoints;

  UserProfile({
    required this.uid,
    required this.email,
    this.displayName,
    this.photoUrl,
    this.reputation = 100,
    this.stellarPoints = 0.0,
  });

  factory UserProfile.fromFirestore(DocumentSnapshot doc, User firebaseUser) {
    Map<String, dynamic> data = doc.data() as Map<String, dynamic>? ?? {};
    return UserProfile(
      uid: firebaseUser.uid,
      email: firebaseUser.email ?? '',
      displayName: firebaseUser.displayName ?? data['displayName'],
      photoUrl: firebaseUser.photoURL ?? data['photoUrl'],
      reputation: data['reputation'] ?? 100,
      stellarPoints: (data['stellarPoints'] as num?)?.toDouble() ?? 0.0,
    );
  }
}

class AuthService extends ChangeNotifier {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  UserProfile? _userProfile;
  UserProfile? get userProfile => _userProfile;
  bool get isAuthenticated => _userProfile != null;

  AuthService() {
    _auth.authStateChanges().listen(_onAuthStateChanged);
  }

  Future<void> _onAuthStateChanged(User? firebaseUser) async {
    if (firebaseUser == null) {
      _userProfile = null;
    } else {
      try {
        DocumentSnapshot doc = await _firestore.collection('users').doc(firebaseUser.uid).get();
        if (!doc.exists) {
          // Create default profile if not exists
          await _firestore.collection('users').doc(firebaseUser.uid).set({
            'email': firebaseUser.email,
            'displayName': firebaseUser.displayName,
            'photoUrl': firebaseUser.photoURL,
            'reputation': 100,
            'stellarPoints': 0.0,
            'createdAt': FieldValue.serverTimestamp(),
          });
          doc = await _firestore.collection('users').doc(firebaseUser.uid).get();
        }
        _userProfile = UserProfile.fromFirestore(doc, firebaseUser);
      } catch (e) {
        print("Error fetching user profile: \$e");
        _userProfile = UserProfile(uid: firebaseUser.uid, email: firebaseUser.email ?? '');
      }
    }
    notifyListeners();
  }

  Future<void> signInWithEmailPassword(String email, String password) async {
    await _auth.signInWithEmailAndPassword(email: email, password: password);
  }

  Future<void> registerWithEmailPassword(String email, String password) async {
    await _auth.createUserWithEmailAndPassword(email: email, password: password);
  }

  Future<void> signOut() async {
    await _auth.signOut();
  }
}
