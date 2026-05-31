from django.contrib import admin

from feedback_app.models import BugFeatureReport, FeedbackScreenshot


@admin.register(BugFeatureReport)
class BugFeatureReportAdmin(admin.ModelAdmin):
    list_display = (
        'type',
        'title',
        'status',
        'workspace',
        'user',
        'created_at',
    )
    list_filter = ('type', 'status', 'created_at')
    search_fields = ('title', 'description', 'admin_notes')
    readonly_fields = (
        'id',
        'workspace',
        'user',
        'type',
        'title',
        'description',
        'screenshot',
        'created_at',
    )
    fields = (
        'id',
        'workspace',
        'user',
        'type',
        'title',
        'description',
        'screenshot',
        'created_at',
        'status',
        'admin_notes',
    )


@admin.register(FeedbackScreenshot)
class FeedbackScreenshotAdmin(admin.ModelAdmin):
    list_display = ('id', 'uploaded_by', 'uploaded_at')
    readonly_fields = ('id', 'image', 'uploaded_by', 'uploaded_at')
    search_fields = ('uploaded_by__email',)
