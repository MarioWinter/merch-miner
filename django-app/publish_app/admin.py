from django.contrib import admin

from publish_app.models import (
    DesignAsset,
    DesignCollection,
    DesignProductConfig,
    Listing,
    ProductLifecycle,
    UploadJob,
    UploadTemplate,
)


@admin.register(DesignCollection)
class DesignCollectionAdmin(admin.ModelAdmin):
    list_display = ['id', 'workspace', 'name', 'parent', 'position', 'created_by', 'created_at']
    list_filter = ['workspace']
    search_fields = ['name']
    readonly_fields = ['id', 'created_at']
    raw_id_fields = ['parent', 'workspace', 'created_by']


@admin.register(Listing)
class ListingAdmin(admin.ModelAdmin):
    list_display = ['id', 'workspace', 'idea', 'status', 'generated_by', 'language', 'created_at']
    list_filter = ['status', 'generated_by', 'language']
    search_fields = ['title', 'brand_name']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(UploadTemplate)
class UploadTemplateAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'workspace', 'name', 'marketplace_type', 'is_default',
        'print_side', 'created_at',
    ]
    list_filter = ['marketplace_type', 'is_default', 'print_side']
    search_fields = ['name']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(UploadJob)
class UploadJobAdmin(admin.ModelAdmin):
    list_display = ['id', 'workspace', 'marketplace', 'status', 'asin', 'queued_at']
    list_filter = ['status', 'marketplace']
    search_fields = ['asin']
    readonly_fields = ['id', 'queued_at', 'started_at', 'completed_at']


@admin.register(DesignAsset)
class DesignAssetAdmin(admin.ModelAdmin):
    list_display = ['id', 'workspace', 'file_name', 'source', 'file_size', 'created_at']
    list_filter = ['source']
    search_fields = ['file_name']
    readonly_fields = ['id', 'created_at']


@admin.register(DesignProductConfig)
class DesignProductConfigAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'design', 'marketplace_type', 'print_side', 'updated_at',
    ]
    list_filter = ['marketplace_type', 'print_side']
    search_fields = ['design__file_name']
    readonly_fields = [
        'id', 'created_at', 'updated_at',
        'product_types', 'fit_types', 'colors', 'marketplaces',
    ]
    raw_id_fields = ['design']


@admin.register(ProductLifecycle)
class ProductLifecycleAdmin(admin.ModelAdmin):
    list_display = ['id', 'workspace', 'niche', 'asin', 'marketplace', 'round', 'updated_at']
    list_filter = ['marketplace', 'round']
    search_fields = ['asin']
    readonly_fields = ['id', 'updated_at']
