import os
import re
import logging
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.renderers import BaseRenderer
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django.http import Http404, FileResponse
from django.conf import settings

_RESOLUTION_RE = re.compile(r'^(480p|720p|1080p)$')
_SEGMENT_RE = re.compile(r'^\d{1,6}\.ts$')

from user_auth_app.api.authentication import CookieJWTAuthentication
from .serializers import VideoUploadSerializer, VideoListSerializer, ImageUploadSerializer, ImageListSerializer
from ..models import Video, Image

logger = logging.getLogger(__name__)

class M3U8Renderer(BaseRenderer):
    """Custom renderer for HLS manifest files."""
    media_type = 'application/vnd.apple.mpegurl'
    format = 'm3u8'
    charset = None
    render_style = 'binary'
    
    def render(self, data, accepted_media_type=None, renderer_context=None):
        return data


class TSRenderer(BaseRenderer):
    """Custom renderer for HLS segments."""
    media_type = 'video/MP2T'
    format = 'ts'
    charset = None
    render_style = 'binary'
    
    def render(self, data, accepted_media_type=None, renderer_context=None):
        return data

class VideoUploadView(APIView):
    """API endpoint to upload videos and trigger asynchronous processing."""

    permission_classes = [IsAuthenticated]
    authentication_classes = [CookieJWTAuthentication]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        serializer = VideoUploadSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(
                {"detail": "Video uploaded successfully. Processing started in background."},
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class VideoListView(APIView):
    """API endpoint to list all videos."""
    
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        try:
            if request.user.is_staff:
                videos = Video.objects.all().order_by('-upload_date')
            else:
                videos = Video.objects.filter(owner=request.user).order_by('-upload_date')
            serializer = VideoListSerializer(videos, many=True, context={"request": request})
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        except Exception as e:
            logger.error(f"Error in VideoListView: {e}", exc_info=True)
            return Response(
                {"error": "Unable to fetch videos", "detail": str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class HLSManifestView(APIView):
    """API endpoint to serve HLS master playlist files."""
    
    renderer_classes = [M3U8Renderer]
    permission_classes = [IsAuthenticated]
    
    def get(self, request, movie_id, resolution):
        if not _RESOLUTION_RE.match(resolution):
            raise Http404("Invalid resolution.")

        try:
            video = Video.objects.get(pk=movie_id)
        except Video.DoesNotExist:
            raise Http404("Video not found.")

        media_root = os.path.realpath(settings.MEDIA_ROOT)
        basename, _ = os.path.splitext(os.path.basename(video.original_file.name))
        manifest_path = os.path.realpath(
            os.path.join(media_root, 'videos', 'hls', resolution, basename, "index.m3u8")
        )

        if not manifest_path.startswith(media_root + os.sep):
            raise Http404("Invalid path.")

        if not os.path.isfile(manifest_path):
            raise Http404("HLS manifest not found.")

        return FileResponse(open(manifest_path, "rb"), content_type="application/vnd.apple.mpegurl")


class HLSSegmentView(APIView):
    """API endpoint to serve HLS video segments."""
    
    renderer_classes = [TSRenderer]
    permission_classes = [IsAuthenticated]
    
    def get(self, request, movie_id, resolution, segment):
        if not _RESOLUTION_RE.match(resolution):
            raise Http404("Invalid resolution.")
        if not _SEGMENT_RE.match(segment):
            raise Http404("Invalid segment.")

        try:
            video = Video.objects.get(pk=movie_id)
        except Video.DoesNotExist:
            raise Http404("Video not found.")

        media_root = os.path.realpath(settings.MEDIA_ROOT)
        basename, _ = os.path.splitext(os.path.basename(video.original_file.name))
        segment_path = os.path.realpath(
            os.path.join(media_root, 'videos', 'hls', resolution, basename, segment)
        )

        if not segment_path.startswith(media_root + os.sep):
            raise Http404("Invalid path.")

        if not os.path.isfile(segment_path):
            raise Http404("HLS segment not found.")

        return FileResponse(open(segment_path, "rb"), content_type="video/MP2T")


class ImageUploadView(APIView):
    """API endpoint to upload images."""

    permission_classes = [IsAuthenticated]
    authentication_classes = [CookieJWTAuthentication]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        serializer = ImageUploadSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(
                {"detail": "Image uploaded successfully."},
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ImageListView(APIView):
    """API endpoint to list images."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            if request.user.is_staff:
                images = Image.objects.all()
            else:
                images = Image.objects.filter(owner=request.user)
            serializer = ImageListSerializer(images, many=True, context={"request": request})
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error in ImageListView: {e}", exc_info=True)
            return Response(
                {"error": "Unable to fetch images", "detail": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
