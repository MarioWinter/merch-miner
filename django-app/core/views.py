from django.db import connection
from django.http import JsonResponse


def health(request):
    try:
        connection.ensure_connection()
        return JsonResponse({'status': 'ok'})
    except Exception as e:
        return JsonResponse({'status': 'error', 'detail': str(e)}, status=503)


def handler404(request, exception=None):
    return JsonResponse({'detail': 'Not found.'}, status=404)
