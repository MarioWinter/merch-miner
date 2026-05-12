"""Django Admin for ChatNodeConfig + ChatNodeConfigVersion (PROJ-29, AC-19 + AC-20)."""

from django.contrib import admin, messages
from django.http import HttpResponseRedirect
from django.shortcuts import get_object_or_404, render
from django.urls import path, reverse
from django.utils.html import format_html

from chat_node_config_app._default_prompts import (
    DEFAULT_PROMPTS,
    DEFAULT_USER_TEMPLATES,
)
from chat_node_config_app.models import ChatNodeConfig, ChatNodeConfigVersion
from chat_node_config_app.services.resolver import get_chat_prompt


# Canonical placeholder lists per AC-18. Hint shown above textarea in admin.
PLACEHOLDERS_BY_NODE = {
    'agent_react': [
        'niche_name', 'user_language', 'marketplace_language',
        'conversation_summary', 'tool_descriptions',
    ],
    'creative_techniques': [
        'niche_name', 'marketplace_language', 'niche_keywords_topN',
        'recent_slogans_sample', 'niche_analysis_snippet', 'requested_style',
        'signal_mix', 'count',
    ],
    'chat_with_niche': [
        'niche_name', 'user_language', 'marketplace_language',
        'conversation_summary', 'niche_analysis_snippet', 'niche_keywords_topN',
        'recent_slogans_sample', 'web_search_results',
    ],
    'chat_no_niche': [
        'niche_name', 'user_language', 'marketplace_language',
        'conversation_summary', 'web_search_results',
    ],
    'query_rewrite': [
        'user_query', 'niche_name', 'user_language', 'marketplace_language',
    ],
    'contextual_header': [
        'niche_name', 'content_type', 'raw_text',
    ],
    'follow_up_suggester': [
        'user_language', 'niche_name', 'last_user_message',
        'last_assistant_message_summary',
    ],
    'conversation_summarizer': [
        'niche_name', 'messages_to_summarize',
    ],
}


# Hardcoded sample render context for "Preview with sample data" (AC-19).
SAMPLE_CONTEXT = {
    'niche_name': 'Bus Driver',
    'user_language': 'en',
    'marketplace_language': 'en',
    'conversation_summary': '(no prior conversation)',
    'tool_descriptions': '(8 tools registered — see niche_chat_agent.py)',
    'niche_keywords_topN': 'bus driver, school bus, cdl, route, shift',
    'recent_slogans_sample': '- "I Survived the 6AM Shift" (pattern: ENDURANCE/SURVIVAL, signal: self)',
    'niche_analysis_snippet': 'summary: profession-pride niche | emotional_reality: endurance + boundary',
    'requested_style': '(any)',
    'signal_mix': '5 SELF + 5 OTHER',
    'count': 10,
    'theme': 'morning shift humor',
    'web_search_results': '(no live results in preview)',
    'user_query': 'what makes a good slogan for this niche',
    'content_type': 'slogan',
    'raw_text': 'I Survived the 6AM Shift',
    'last_user_message': 'give me 10 slogans',
    'last_assistant_message_summary': 'Delivered 10 ENDURANCE/SURVIVAL slogans, user added 4.',
    'messages_to_summarize': '[{"role":"user","content":"..."}]',
}


@admin.register(ChatNodeConfig)
class ChatNodeConfigAdmin(admin.ModelAdmin):
    list_display = ('node_name', 'model_name', 'temperature', 'is_active', 'updated_at')
    list_filter = ('is_active',)
    readonly_fields = ('updated_at', 'placeholder_hint', 'version_history')
    fields = (
        'node_name', 'is_active', 'model_name', 'temperature', 'max_tokens',
        'placeholder_hint', 'system_prompt', 'version_history', 'updated_by',
        'updated_at',
    )

    def get_form(self, request, obj=None, **kwargs):
        form = super().get_form(request, obj, **kwargs)
        form.base_fields['system_prompt'].widget.attrs.update({
            'rows': 30,
            'cols': 120,
            'style': 'font-family: monospace; width: 100%;',
        })
        return form

    def save_model(self, request, obj, form, change):
        obj.updated_by = request.user
        super().save_model(request, obj, form, change)

    @admin.display(description='Available placeholders')
    def placeholder_hint(self, obj):
        if not obj or not obj.node_name:
            return '(save once to see placeholders for the chosen node)'
        placeholders = PLACEHOLDERS_BY_NODE.get(obj.node_name, [])
        if not placeholders:
            return '(no placeholders known for this node)'
        rendered = ', '.join(f'{{{p}}}' for p in placeholders)
        preview_url = reverse(
            'admin:chat_node_config_app_chatnodeconfig_preview',
            args=[obj.pk],
        )
        return format_html(
            '<code>{}</code><br><a class="button" href="{}">Preview with sample data</a>',
            rendered, preview_url,
        )

    @admin.display(description='Version history (10 newest)')
    def version_history(self, obj):
        if not obj or not obj.pk:
            return '(saved once to see version history)'
        versions = ChatNodeConfigVersion.objects.filter(
            node_name=obj.node_name,
        ).order_by('-snapshot_at')[:10]
        if not versions:
            return '(no versions yet)'
        lines = []
        for v in versions:
            restore_url = reverse(
                'admin:chat_node_config_app_chatnodeconfig_restore',
                args=[obj.pk, v.pk],
            )
            lines.append(format_html(
                '<li>{} — {} (T={}) <a href="{}">Restore</a></li>',
                v.snapshot_at.strftime('%Y-%m-%d %H:%M:%S'),
                v.model_name, v.temperature, restore_url,
            ))
        return format_html('<ul>{}</ul>', format_html(''.join(lines)))

    def get_urls(self):
        urls = super().get_urls()
        custom = [
            path(
                '<int:object_id>/preview/',
                self.admin_site.admin_view(self.preview_view),
                name='chat_node_config_app_chatnodeconfig_preview',
            ),
            path(
                '<int:object_id>/restore/<int:version_id>/',
                self.admin_site.admin_view(self.restore_view),
                name='chat_node_config_app_chatnodeconfig_restore',
            ),
        ]
        return custom + urls

    def preview_view(self, request, object_id):
        obj = get_object_or_404(ChatNodeConfig, pk=object_id)
        keys = PLACEHOLDERS_BY_NODE.get(obj.node_name, [])
        ctx = {k: SAMPLE_CONTEXT.get(k, f'<{k}>') for k in keys}
        try:
            rendered = get_chat_prompt(obj.node_name, **ctx)
            error = ''
        except KeyError as exc:
            rendered = ''
            error = str(exc)
        user_template = DEFAULT_USER_TEMPLATES.get(obj.node_name, '')
        return render(
            request,
            'admin/chat_node_config_app/preview.html',
            {
                'title': f'Preview: {obj}',
                'config': obj,
                'sample_context': ctx,
                'rendered': rendered,
                'error': error,
                'user_template': user_template,
                'default_prompt_len': len(DEFAULT_PROMPTS.get(obj.node_name, '')),
            },
        )

    def restore_view(self, request, object_id, version_id):
        obj = get_object_or_404(ChatNodeConfig, pk=object_id)
        version = get_object_or_404(ChatNodeConfigVersion, pk=version_id)
        if version.node_name != obj.node_name:
            self.message_user(
                request,
                f"Version belongs to '{version.node_name}', not '{obj.node_name}'.",
                level=messages.ERROR,
            )
        else:
            obj.model_name = version.model_name
            obj.temperature = version.temperature
            obj.max_tokens = version.max_tokens
            obj.system_prompt = version.system_prompt
            obj.updated_by = request.user
            obj.save()
            self.message_user(
                request,
                f"Restored '{obj.node_name}' from snapshot at {version.snapshot_at}.",
                level=messages.SUCCESS,
            )
        return HttpResponseRedirect(
            reverse(
                'admin:chat_node_config_app_chatnodeconfig_change',
                args=[obj.pk],
            ),
        )


@admin.register(ChatNodeConfigVersion)
class ChatNodeConfigVersionAdmin(admin.ModelAdmin):
    list_display = ('node_name', 'model_name', 'temperature', 'snapshot_at', 'snapshot_by')
    list_filter = ('node_name',)
    readonly_fields = (
        'node_name', 'model_name', 'temperature', 'max_tokens',
        'system_prompt', 'snapshot_at', 'snapshot_by',
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        # Versions immutable; 10-cap purge handles cleanup via signal.
        return False
