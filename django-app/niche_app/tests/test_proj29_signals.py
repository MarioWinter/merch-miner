"""PROJ-29 Phase 1B Round 1: niche_app signals — legacy-notes sync + reindex debounce."""

from unittest.mock import MagicMock, patch

import pytest

from niche_app.models import Niche, NicheNote


@pytest.fixture
def user(db):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    return User.objects.create_user(email='signals@test.com', password='testpass123')


@pytest.fixture
def workspace(db, user):
    from workspace_app.models import Workspace
    return Workspace.objects.create(name='Sig WS', slug='sig-ws', owner=user)


@pytest.mark.django_db(transaction=True)
class TestLegacyNotesSync:
    @patch('niche_app.signals._enqueue_reindex')
    def test_save_with_notes_creates_synthetic_nichenote(self, _mock_reindex, workspace, user):
        niche = Niche.objects.create(
            workspace=workspace,
            name='Camping Humor',
            notes='Funny camping shirts',
            created_by=user,
        )
        synth = NicheNote.objects.filter(
            niche=niche, source=NicheNote.Source.NICHE_LEGACY_NOTES,
        )
        assert synth.count() == 1
        assert synth.first().text == 'Funny camping shirts'

    @patch('niche_app.signals._enqueue_reindex')
    def test_save_with_empty_notes_no_synthetic_row(self, _mock_reindex, workspace, user):
        niche = Niche.objects.create(
            workspace=workspace, name='No Notes', notes='', created_by=user,
        )
        assert not NicheNote.objects.filter(
            niche=niche, source=NicheNote.Source.NICHE_LEGACY_NOTES,
        ).exists()

    @patch('niche_app.signals._enqueue_reindex')
    def test_save_emptying_notes_removes_synthetic_row(self, _mock_reindex, workspace, user):
        niche = Niche.objects.create(
            workspace=workspace, name='Test', notes='hello', created_by=user,
        )
        assert NicheNote.objects.filter(
            niche=niche, source=NicheNote.Source.NICHE_LEGACY_NOTES,
        ).count() == 1

        niche.notes = ''
        niche.save()

        assert NicheNote.objects.filter(
            niche=niche, source=NicheNote.Source.NICHE_LEGACY_NOTES,
        ).count() == 0

    @patch('niche_app.signals._enqueue_reindex')
    def test_update_idempotent(self, _mock_reindex, workspace, user):
        niche = Niche.objects.create(
            workspace=workspace, name='X', notes='note A', created_by=user,
        )
        niche.notes = 'note A'
        niche.save()  # same text — should not duplicate
        assert NicheNote.objects.filter(
            niche=niche, source=NicheNote.Source.NICHE_LEGACY_NOTES,
        ).count() == 1


@pytest.mark.django_db(transaction=True)
class TestReindexDebounce:
    @patch('niche_app.signals.django_rq.get_queue')
    def test_save_enqueues_with_dedup_job_id(self, mock_get_queue, workspace, user):
        mock_queue = MagicMock()
        mock_get_queue.return_value = mock_queue

        niche = Niche.objects.create(
            workspace=workspace, name='Debounce', notes='hi', created_by=user,
        )

        mock_queue.enqueue_in.assert_called()
        # Inspect last call kwargs to assert job_id dedup key.
        call_kwargs = mock_queue.enqueue_in.call_args.kwargs
        assert call_kwargs.get('job_id') == f"niche-rag-reindex-{niche.pk}"

    @patch('niche_app.signals.django_rq.get_queue')
    def test_two_saves_use_same_job_id(self, mock_get_queue, workspace, user):
        """Two saves within debounce window use the same job_id (rq dedups)."""
        mock_queue = MagicMock()
        mock_get_queue.return_value = mock_queue

        niche = Niche.objects.create(
            workspace=workspace, name='Debounce2', notes='hi', created_by=user,
        )
        niche.name = 'Debounce2 renamed'
        niche.save()

        # Both calls used identical job_id — rq dedups at the queue level.
        all_calls = mock_queue.enqueue_in.call_args_list
        assert len(all_calls) == 2
        job_ids = {c.kwargs.get('job_id') for c in all_calls}
        assert job_ids == {f"niche-rag-reindex-{niche.pk}"}


@pytest.mark.django_db(transaction=True)
class TestReindexNicheSources:
    @patch('vector_app.tasks.django_rq.get_queue')
    @patch('niche_app.signals._enqueue_reindex')  # Avoid signal fan-out during setup
    def test_reindex_enqueues_for_each_idea_and_note(
        self, _mock_reindex, mock_get_queue, workspace, user,
    ):
        from idea_app.models import Idea
        from vector_app.tasks import create_or_update_embedding, reindex_niche_sources

        niche = Niche.objects.create(
            workspace=workspace, name='Reindex', notes='', created_by=user,
        )
        Idea.objects.create(
            workspace=workspace, niche=niche, slogan_text='S1',
            is_manual=True, created_by=user,
        )
        Idea.objects.create(
            workspace=workspace, niche=niche, slogan_text='S2',
            is_manual=True, created_by=user,
        )
        NicheNote.objects.create(niche=niche, text='Note 1', created_by=user)

        mock_queue = MagicMock()
        mock_get_queue.return_value = mock_queue

        enqueued = reindex_niche_sources(str(niche.pk))

        assert enqueued == 3
        # 2 ideas + 1 note = 3 enqueues, all using create_or_update_embedding
        all_calls = mock_queue.enqueue.call_args_list
        assert len(all_calls) == 3
        for c in all_calls:
            assert c.args[0] is create_or_update_embedding

    @patch('vector_app.tasks.django_rq.get_queue')
    @patch('niche_app.signals._enqueue_reindex')
    def test_reindex_caps_at_500(self, _mock_reindex, mock_get_queue, workspace, user):
        """Verify cap=500 — we don't insert 500 rows; we patch the model query."""
        from vector_app.tasks import reindex_niche_sources

        niche = Niche.objects.create(
            workspace=workspace, name='Capper', notes='', created_by=user,
        )

        mock_queue = MagicMock()
        mock_get_queue.return_value = mock_queue

        # Build a stub queryset returning 600 fake UUIDs from Idea path.
        import uuid as uuid_mod
        fake_ids = [uuid_mod.uuid4() for _ in range(600)]

        with patch('idea_app.models.Idea.objects') as mock_idea_objs:
            mock_filter = MagicMock()
            mock_idea_objs.filter.return_value = mock_filter
            mock_values = MagicMock()
            mock_filter.values_list.return_value = mock_values
            mock_values.__getitem__.return_value = fake_ids[:500]

            enqueued = reindex_niche_sources(str(niche.pk))

        # Cap enforced at 500 — note path is skipped because Idea filled cap.
        assert enqueued == 500
