from django.contrib import admin

from search_app.models import (
    ChatMessage,
    ChatSession,
    ChatTag,
    SearchUsageLog,
    WebSearchResult,
)


@admin.register(ChatTag)
class ChatTagAdmin(admin.ModelAdmin):
    list_display = ['name', 'workspace', 'color', 'is_system', 'created_at']
    list_filter = ['is_system', 'workspace']
    search_fields = ['name']


class ChatMessageInline(admin.TabularInline):
    model = ChatMessage
    extra = 0
    readonly_fields = ['id', 'role', 'content', 'message_type', 'created_at']
    fields = ['role', 'content', 'message_type', 'model_used', 'created_at']


@admin.register(ChatSession)
class ChatSessionAdmin(admin.ModelAdmin):
    list_display = ['title', 'workspace', 'created_by', 'is_shared', 'updated_at']
    list_filter = ['is_shared', 'workspace']
    search_fields = ['title']
    inlines = [ChatMessageInline]
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ['session', 'role', 'message_type', 'model_used', 'created_at']
    list_filter = ['role', 'message_type']
    search_fields = ['content']
    readonly_fields = ['id', 'created_at']


@admin.register(WebSearchResult)
class WebSearchResultAdmin(admin.ModelAdmin):
    list_display = ['title', 'url', 'content_type', 'crawl_status', 'workspace', 'created_at']
    list_filter = ['content_type', 'crawl_status', 'workspace']
    search_fields = ['title', 'url']
    readonly_fields = ['id', 'created_at']


@admin.register(SearchUsageLog)
class SearchUsageLogAdmin(admin.ModelAdmin):
    list_display = ['action', 'user', 'workspace', 'model_used', 'tokens_used', 'created_at']
    list_filter = ['action', 'workspace']
    search_fields = ['query', 'url']
    readonly_fields = ['id', 'created_at']
