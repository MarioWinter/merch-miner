from django.http import JsonResponse


def handler404(request, exception=None):
    return JsonResponse({'detail': 'Not found.'}, status=404)
