import 'dart:convert';
import 'dart:io';
import 'package:integration_test/integration_test_driver_extended.dart';

Future<void> main() => integrationDriver(
      responseDataCallback: (Map<String, dynamic>? data) async {
        if (data == null) return;
        final rawResults = data['screenshotResults'];
        if (rawResults == null) return;
        if (rawResults is! Map) return;
        final screenshotResults = rawResults.cast<String, String>();
        final dir = Directory('screenshots');
        if (!dir.existsSync()) dir.createSync(recursive: true);
        for (final entry in screenshotResults.entries) {
          final bytes = base64Decode(entry.value);
          final file = File('${dir.path}/${entry.key}.png');
          await file.writeAsBytes(bytes);
          // ignore: avoid_print
          print('Saved screenshot: ${file.path}');
        }
      },
    );
