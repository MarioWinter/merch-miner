import pytest
from django.contrib.auth import get_user_model

from idea_app.models import Idea, IdeaAdaptationRun, SloganNodeConfig

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(email='test@test.com', password='test1234')


@pytest.fixture
def workspace(db, user):
    from workspace_app.models import Workspace
    return Workspace.objects.create(name='Test Workspace', slug='test-workspace', owner=user)


@pytest.fixture
def niche(workspace):
    from niche_app.models import Niche
    return Niche.objects.create(workspace=workspace, name='Fishing', created_by=workspace.owner)


@pytest.fixture
def idea(workspace, niche, user):
    return Idea.objects.create(
        workspace=workspace,
        niche=niche,
        slogan_text='I\'d Rather Be Fishing',
        is_manual=True,
        created_by=user,
    )


class TestSloganNodeConfig:
    def test_create_config(self, db):
        config = SloganNodeConfig.objects.create(
            node_name='analyze_original',
            model_name='openai/gpt-4.1-mini',
            temperature=0.2,
        )
        assert config.node_name == 'analyze_original'
        assert str(config) == 'Analyze Original (openai/gpt-4.1-mini)'

    def test_node_defaults_dict(self, db):
        assert 'analyze_original' in SloganNodeConfig.NODE_DEFAULTS
        assert SloganNodeConfig.NODE_DEFAULTS['adapt_slogans']['temperature'] == 0.8


class TestIdea:
    def test_create_idea(self, idea):
        assert idea.is_manual is True
        assert idea.status == Idea.Status.PENDING
        assert idea.niche is not None

    def test_niche_nullable(self, workspace, user):
        idea = Idea.objects.create(
            workspace=workspace,
            niche=None,
            slogan_text='No niche idea',
            created_by=user,
        )
        assert idea.niche is None

    def test_get_embedding_text(self, idea):
        idea.why_it_works = 'Speaks to fishing identity'
        idea.save()
        text = idea.get_embedding_text()
        assert 'Rather Be Fishing' in text
        assert 'fishing identity' in text

    def test_str_truncation(self, workspace, user):
        long_text = 'A' * 200
        idea = Idea.objects.create(
            workspace=workspace,
            slogan_text=long_text,
            created_by=user,
        )
        assert len(str(idea)) == 80

    def test_status_choices(self, idea):
        idea.status = Idea.Status.APPROVED
        idea.save()
        idea.refresh_from_db()
        assert idea.status == 'approved'

    def test_signal_type_nullable(self, idea):
        assert idea.signal_type is None
        idea.signal_type = 'self'
        idea.save()
        idea.refresh_from_db()
        assert idea.signal_type == 'self'

    def test_market_confidence_choices(self, idea):
        idea.market_confidence = 'High'
        idea.save()
        idea.refresh_from_db()
        assert idea.market_confidence == 'High'

    def test_self_referential_fk(self, workspace, niche, user, idea):
        derived = Idea.objects.create(
            workspace=workspace,
            niche=niche,
            source_idea=idea,
            slogan_text='Derived slogan',
            is_manual=False,
            created_by=user,
        )
        assert derived.source_idea == idea
        assert idea.derived_ideas.count() == 1


class TestIdeaAdaptationRun:
    def test_create_run(self, workspace, idea, user):
        run = IdeaAdaptationRun.objects.create(
            workspace=workspace,
            source_idea=idea,
            target_niche_ids=['niche-1', 'niche-2'],
            triggered_by=user,
        )
        assert run.status == IdeaAdaptationRun.Status.PENDING
        assert len(run.target_niche_ids) == 2
        assert run.completed_nodes == []

    def test_status_transitions(self, workspace, idea, user):
        run = IdeaAdaptationRun.objects.create(
            workspace=workspace,
            source_idea=idea,
            target_niche_ids=[],
            triggered_by=user,
        )
        run.status = IdeaAdaptationRun.Status.RUNNING
        run.save()
        run.status = IdeaAdaptationRun.Status.COMPLETED
        run.save()
        run.refresh_from_db()
        assert run.status == 'completed'

    def test_niche_results_json(self, workspace, idea, user):
        run = IdeaAdaptationRun.objects.create(
            workspace=workspace,
            source_idea=idea,
            target_niche_ids=[],
            triggered_by=user,
            niche_results={
                'niche-1': {'approval_status': 'APPROVED', 'compatibility_score': 85},
                'niche-2': {'approval_status': 'REJECTED', 'rejection_reason': 'Low compatibility'},
            },
        )
        run.refresh_from_db()
        assert run.niche_results['niche-1']['compatibility_score'] == 85
