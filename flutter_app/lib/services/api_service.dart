import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiResult<T> {
  final T? data;
  final String? error;
  final bool requiresPassword;

  const ApiResult({this.data, this.error, this.requiresPassword = false});

  bool get isSuccess => error == null && !requiresPassword;
}

class ApiService {
  final String baseUrl;

  const ApiService(this.baseUrl);

  Map<String, String> _headers({String? token}) {
    final h = <String, String>{'Content-Type': 'application/json'};
    if (token != null) h['Authorization'] = 'Bearer $token';
    return h;
  }

  Future<ApiResult<List<String>>> getUsers() async {
    try {
      final res = await http
          .get(Uri.parse('$baseUrl/api/users'), headers: _headers())
          .timeout(const Duration(seconds: 10));
      if (res.statusCode == 200) {
        return ApiResult(
            data: (jsonDecode(res.body) as List).cast<String>());
      }
      return ApiResult(error: 'HTTP ${res.statusCode}');
    } catch (e) {
      return ApiResult(error: e.toString());
    }
  }

  Future<ApiResult<Map<String, dynamic>>> login(
      String username, String? password) async {
    try {
      final body = <String, dynamic>{'username': username};
      if (password != null && password.isNotEmpty) body['password'] = password;
      final res = await http
          .post(Uri.parse('$baseUrl/api/login'),
              headers: _headers(), body: jsonEncode(body))
          .timeout(const Duration(seconds: 10));
      if (res.statusCode == 200) {
        return ApiResult(
            data: jsonDecode(res.body) as Map<String, dynamic>);
      }
      if (res.statusCode == 401) {
        try {
          final j = jsonDecode(res.body) as Map<String, dynamic>;
          if (j['requiresPassword'] == true) {
            return const ApiResult(requiresPassword: true);
          }
        } catch (_) {}
        return const ApiResult(error: 'Falsches Passwort');
      }
      return ApiResult(error: 'HTTP ${res.statusCode}');
    } catch (e) {
      return ApiResult(error: e.toString());
    }
  }

  Future<ApiResult<Map<String, dynamic>>> createUser(
      String username, String? password) async {
    try {
      final body = <String, dynamic>{'username': username};
      if (password != null && password.isNotEmpty) body['password'] = password;
      final res = await http
          .post(Uri.parse('$baseUrl/api/users'),
              headers: _headers(), body: jsonEncode(body))
          .timeout(const Duration(seconds: 10));
      if (res.statusCode == 200 || res.statusCode == 201) {
        return ApiResult(
            data: jsonDecode(res.body) as Map<String, dynamic>);
      }
      try {
        final j = jsonDecode(res.body) as Map<String, dynamic>;
        return ApiResult(error: j['error']?.toString() ?? 'Fehler');
      } catch (_) {
        return ApiResult(error: 'HTTP ${res.statusCode}');
      }
    } catch (e) {
      return ApiResult(error: e.toString());
    }
  }

  Future<ApiResult<Map<String, dynamic>>> getPlan(
      String username, String token) async {
    try {
      final res = await http
          .get(Uri.parse('$baseUrl/api/plan/${Uri.encodeComponent(username)}'),
              headers: _headers(token: token))
          .timeout(const Duration(seconds: 10));
      if (res.statusCode == 200) {
        return ApiResult(
            data: jsonDecode(res.body) as Map<String, dynamic>);
      }
      return ApiResult(error: 'HTTP ${res.statusCode}');
    } catch (e) {
      return ApiResult(error: e.toString());
    }
  }

  Future<ApiResult<void>> savePlan(
      String username, String token, Map<String, dynamic> plan) async {
    try {
      final res = await http
          .post(
              Uri.parse(
                  '$baseUrl/api/plan/${Uri.encodeComponent(username)}'),
              headers: _headers(token: token),
              body: jsonEncode(plan))
          .timeout(const Duration(seconds: 10));
      if (res.statusCode == 200 || res.statusCode == 201) {
        return const ApiResult(data: null);
      }
      return ApiResult(error: 'HTTP ${res.statusCode}');
    } catch (e) {
      return ApiResult(error: e.toString());
    }
  }

  Future<ApiResult<void>> deleteUser(
      String username, String token) async {
    try {
      final res = await http
          .delete(
              Uri.parse(
                  '$baseUrl/api/users/${Uri.encodeComponent(username)}'),
              headers: _headers(token: token))
          .timeout(const Duration(seconds: 10));
      if (res.statusCode == 200) {
        return const ApiResult(data: null);
      }
      try {
        final j = jsonDecode(res.body) as Map<String, dynamic>;
        return ApiResult(error: j['error']?.toString() ?? 'Fehler');
      } catch (_) {
        return ApiResult(error: 'HTTP ${res.statusCode}');
      }
    } catch (e) {
      return ApiResult(error: e.toString());
    }
  }
}
