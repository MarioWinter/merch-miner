"""WorkflowTemplate CRUD service (AC-25).

API CRUD endpoints already exist (Phase 1 stubs polished in Phase 7);
this module provides a clean service layer reusable by the orchestrator,
batch jobs, and Phase 7 settings UI.

Functions:
    - ``list_templates(workspace)`` → all (system + custom) for workspace
    - ``get_template(workspace, key)`` → single by key, or None
    - ``create_custom_template(workspace, user, name, key, steps)``
    - ``update_custom_template(template, **fields)`` (rejects is_system=True)
    - ``delete_custom_template(template)`` (rejects is_system=True)
"""

from __future__ import annotations

import logging
from typing import Optional

from django.core.exceptions import ValidationError as DjangoValidationError

from agent_app.models import WorkflowTemplate, validate_workflow_steps

logger = logging.getLogger(__name__)


def list_templates(workspace) -> list[WorkflowTemplate]:
    """Return all templates (system + custom) for a workspace, sorted."""
    return list(
        WorkflowTemplate.objects.filter(workspace=workspace)
        .order_by('-is_system', 'name')
    )


def get_template(workspace, key: str) -> Optional[WorkflowTemplate]:
    """Return a workflow template by key (system or custom), or None."""
    if not key:
        return None
    return WorkflowTemplate.objects.filter(workspace=workspace, key=key).first()


def create_custom_template(
    workspace,
    user,
    name: str,
    key: str,
    steps: list,
) -> WorkflowTemplate:
    """Create a non-system template after EC-14 validation.

    Raises:
        ValueError: if key already exists in workspace.
        DjangoValidationError: if steps fail EC-14 validation.
    """
    if WorkflowTemplate.objects.filter(workspace=workspace, key=key).exists():
        raise ValueError(f"Template key '{key}' already exists in workspace.")

    errs = validate_workflow_steps(steps)
    if errs:
        raise DjangoValidationError(errs)

    template = WorkflowTemplate.objects.create(
        workspace=workspace,
        created_by=user,
        name=name,
        key=key,
        is_system=False,
        steps=steps,
    )
    logger.info("Created custom WorkflowTemplate %s for workspace %s", key, workspace.pk)
    return template


def update_custom_template(template: WorkflowTemplate, **fields) -> WorkflowTemplate:
    """Patch a custom template — refuses system templates.

    Raises:
        ValueError: if template.is_system.
        DjangoValidationError: if steps update fails EC-14 validation.
    """
    if template.is_system:
        raise ValueError("System templates are read-only.")

    if 'steps' in fields:
        errs = validate_workflow_steps(fields['steps'])
        if errs:
            raise DjangoValidationError(errs)

    for field, value in fields.items():
        if field in ('is_system', 'workspace', 'id', 'created_at'):
            continue
        setattr(template, field, value)
    template.save()
    return template


def delete_custom_template(template: WorkflowTemplate) -> None:
    """Delete a custom template — refuses system templates."""
    if template.is_system:
        raise ValueError("System templates cannot be deleted.")
    template.delete()


__all__ = [
    'list_templates',
    'get_template',
    'create_custom_template',
    'update_custom_template',
    'delete_custom_template',
]
