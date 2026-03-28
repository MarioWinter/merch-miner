"""Add PostgreSQL trigger to auto-update search_vector from search_text."""

from django.db import migrations


TRIGGER_SQL = """
CREATE OR REPLACE FUNCTION embedding_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', COALESCE(NEW.search_text, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER embedding_search_vector_trigger
    BEFORE INSERT OR UPDATE OF search_text
    ON vector_app_embedding
    FOR EACH ROW
    EXECUTE FUNCTION embedding_search_vector_update();
"""

REVERSE_SQL = """
DROP TRIGGER IF EXISTS embedding_search_vector_trigger ON vector_app_embedding;
DROP FUNCTION IF EXISTS embedding_search_vector_update();
"""


class Migration(migrations.Migration):

    dependencies = [
        ('vector_app', '0001_initial'),
    ]

    operations = [
        migrations.RunSQL(sql=TRIGGER_SQL, reverse_sql=REVERSE_SQL),
    ]
