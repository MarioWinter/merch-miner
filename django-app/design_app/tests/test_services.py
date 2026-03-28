"""Tests for design_app services."""


from design_app.services.prompt_builder import build_from_analysis, build_from_idea


class TestPromptBuilder:
    def test_build_from_analysis_with_final_prompt(self):
        analysis = {
            'text_dna': {'text': 'Coffee Lover'},
            'final_prompt': 'Bold serif "Coffee Lover", coffee beans, vintage style',
        }
        result = build_from_analysis(analysis, 'light_gray')
        assert 'Coffee Lover' in result
        assert '#D3D3D3' in result
        assert 'no gradients' in result

    def test_build_from_analysis_fallback(self):
        analysis = {
            'text_dna': {'text': 'Hello', 'font_style': 'bold serif'},
            'visual': {'style': 'vintage', 'elements': 'coffee beans'},
            'style': {'aesthetic': 'retro'},
        }
        result = build_from_analysis(analysis, 'neon_pink')
        assert 'Hello' in result
        assert '#FF6EC7' in result
        assert 'print resolution' in result

    def test_build_from_analysis_empty(self):
        result = build_from_analysis({}, 'neon_green')
        assert '#39FF14' in result

    def test_build_from_idea_basic(self):
        class MockIdea:
            slogan_text = 'Best Dad Ever'
            emotional_archetype = 'warm'

        result = build_from_idea(MockIdea(), 'light_gray')
        assert 'Best Dad Ever' in result
        assert '#D3D3D3' in result

    def test_build_from_idea_with_references(self):
        class MockIdea:
            slogan_text = 'Dog Mom'
            emotional_archetype = ''

        refs = [
            {
                'visual_style': 'minimalist',
                'graphic_elements': 'paw print',
                'vibe': {'primary': 'playful'},
                'tone': 'humorous',
            },
        ]
        result = build_from_idea(MockIdea(), 'neon_green', reference_analyses=refs)
        assert 'Dog Mom' in result
        assert 'minimalist' in result
        assert 'paw print' in result
