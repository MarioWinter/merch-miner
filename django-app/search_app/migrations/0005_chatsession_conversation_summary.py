"""PROJ-29 Phase 1D Round 1D-3 — add `ChatSession.conversation_summary`.

AC-Context-2: when conversation history exceeds 10 turns, an rq job
(`agent_app.tasks.summarize_conversation`) rolls turns 1..(N-5) into a 1-2
paragraph summary stored in this field; the next-turn prompt assembler
substitutes the summary for the trimmed turns.
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('search_app', '0004_chatsession_share_token'),
    ]

    operations = [
        migrations.AddField(
            model_name='chatsession',
            name='conversation_summary',
            field=models.TextField(
                blank=True,
                default='',
                help_text=(
                    'Rolling summary of turns 1..(N-5) when conversation '
                    'exceeds 10 turns (PROJ-29 AC-Context-2). Regenerated '
                    'after each new turn via the conversation_summarizer '
                    'rq job; eventually consistent (EC-28).'
                ),
            ),
        ),
    ]
