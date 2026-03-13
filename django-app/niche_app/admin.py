from django.contrib import admin
from .models import Niche


@admin.register(Niche)
class NicheAdmin(admin.ModelAdmin):
    list_display = ('name', 'workspace', 'status', 'potential_rating', 'assigned_to', 'position', 'created_at')
    list_filter = ('status', 'potential_rating', 'research_status', 'workspace')
    search_fields = ('name', 'notes')
    readonly_fields = ('id', 'created_at', 'updated_at')
    raw_id_fields = ('workspace', 'assigned_to', 'created_by')
