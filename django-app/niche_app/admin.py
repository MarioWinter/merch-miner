from django.contrib import admin
from .models import Niche, NicheFilterTemplate, NicheNote


@admin.register(Niche)
class NicheAdmin(admin.ModelAdmin):
    list_display = ('name', 'workspace', 'status', 'potential_rating', 'assigned_to', 'position', 'created_at')
    list_filter = ('status', 'potential_rating', 'research_status', 'workspace')
    search_fields = ('name', 'notes')
    readonly_fields = ('id', 'created_at', 'updated_at')
    raw_id_fields = ('workspace', 'assigned_to', 'created_by')


@admin.register(NicheFilterTemplate)
class NicheFilterTemplateAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'created_at', 'updated_at')
    list_filter = ('user',)
    search_fields = ('name',)
    readonly_fields = ('id', 'created_at', 'updated_at')
    raw_id_fields = ('user',)


@admin.register(NicheNote)
class NicheNoteAdmin(admin.ModelAdmin):
    list_display = ('niche', 'created_by', 'created_at', 'updated_at')
    list_filter = ('created_by',)
    search_fields = ('text', 'niche__name')
    readonly_fields = ('id', 'created_at', 'updated_at')
    raw_id_fields = ('niche', 'created_by')
