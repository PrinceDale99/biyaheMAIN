import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:biyahe_app/main.dart'; // For BiyaheTheme
import 'package:biyahe_app/services/auth_service.dart';
import 'package:provider/provider.dart';

class RewardsScreen extends StatefulWidget {
  const RewardsScreen({super.key});

  @override
  State<RewardsScreen> createState() => _RewardsScreenState();
}

class _RewardsScreenState extends State<RewardsScreen> {
  final TextEditingController _addressController = TextEditingController();
  bool _isLoading = false;

  Future<void> _claimRewards(AuthService authService) async {
    final address = _addressController.text.trim();
    if (address.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a Stellar address')),
      );
      return;
    }

    if (!authService.isAuthenticated) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('You must be logged in to claim rewards')),
      );
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      final response = await http.post(
        Uri.parse('https://biyahemain.onrender.com/api/rewards/claim'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'address': address,
          'uid': authService.userProfile!.uid,
        }),
      );

      if (response.statusCode == 200) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Rewards successfully claimed!')),
          );
          _addressController.clear();
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Failed to claim rewards: \${response.body}')),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: \$e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final authService = Provider.of<AuthService>(context);

    return Scaffold(
      backgroundColor: BiyaheTheme.bg,
      appBar: AppBar(
        title: const Text('Rewards', style: TextStyle(color: Colors.white)),
        backgroundColor: BiyaheTheme.card,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Icon(Icons.stars, color: Colors.amber, size: 80),
            const SizedBox(height: 24),
            const Text(
              'Claim Your Stellar Points',
              style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 12),
            Text(
              'Convert your travel points to Stellar tokens.',
              style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 16),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 48),
            if (authService.isAuthenticated) ...[
              Text(
                'Current Balance: \${authService.userProfile?.stellarPoints.toStringAsFixed(2) ?? '0.00'} XLM',
                style: const TextStyle(color: BiyaheTheme.accent, fontSize: 18, fontWeight: FontWeight.w600),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
            ],
            TextField(
              controller: _addressController,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                labelText: 'Stellar Public Key',
                labelStyle: TextStyle(color: Colors.white.withOpacity(0.5)),
                hintText: 'G...',
                hintStyle: TextStyle(color: Colors.white.withOpacity(0.2)),
                enabledBorder: OutlineInputBorder(
                  borderSide: BorderSide(color: Colors.white.withOpacity(0.1)),
                  borderRadius: BorderRadius.circular(12),
                ),
                focusedBorder: OutlineInputBorder(
                  borderSide: const BorderSide(color: BiyaheTheme.primary),
                  borderRadius: BorderRadius.circular(12),
                ),
                filled: true,
                fillColor: BiyaheTheme.card,
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _isLoading ? null : () => _claimRewards(authService),
              style: ElevatedButton.styleFrom(
                backgroundColor: BiyaheTheme.primary,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _isLoading
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : const Text('Claim Rewards', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
            ),
          ],
        ),
      ),
    );
  }
}
