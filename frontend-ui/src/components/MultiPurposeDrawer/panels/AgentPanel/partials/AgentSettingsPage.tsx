import { useState, useCallback, useEffect } from 'react';
import {
  Stack,
  Typography,
  TextField,
  Tabs,
  Tab,
  Box,
  IconButton,
  Skeleton,
  Divider,
  Card,
  CardContent,
  Button,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useTranslation } from 'react-i18next';
import useAgentSettings from '../hooks/useAgentSettings';
import type { AgentType, AgentConfig } from '../types';
import { AGENT_DEFAULTS } from '../types';
import PersonalityPresets from './PersonalityPresets';
import PermissionEditor from './PermissionEditor';
import PresetSelector from './PresetSelector';
import KnowledgeDocList from './KnowledgeDocList';
import TemplateEditor from './TemplateEditor';
import SkillList from './SkillList';
import MemoryEditor from './MemoryEditor';
import UserProfileEditor from './UserProfileEditor';

export type AgentSettingsTab =
  | 'agent'
  | 'permissions'
  | 'knowledge'
  | 'templates'
  | 'skills'
  | 'memory'
  | 'profile';

const TAB_KEYS: AgentSettingsTab[] = [
  'agent',
  'permissions',
  'knowledge',
  'templates',
  'skills',
  'memory',
  'profile',
];

const SettingsRoot = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'hidden',
});

const ScrollArea = styled(Box)({
  flex: 1,
  overflowY: 'auto',
});

const AGENT_TYPES: AgentType[] = [
  'orchestrator',
  'research',
  'ideation',
  'design',
  'listing',
  'publishing',
  'search',
];

interface AgentSettingsPageProps {
  onBack: () => void;
  activePresetName: string;
  /** Optional initial tab to land on (e.g. when ReflectionStatus deep-links
   *  to the Memory tab). Defaults to 'agent'. */
  initialTab?: AgentSettingsTab;
}

const AgentSettingsPage = ({
  onBack,
  activePresetName,
  initialTab = 'agent',
}: AgentSettingsPageProps) => {
  const { t } = useTranslation();
  const {
    configs,
    permissions,
    presets,
    configsLoading,
    permissionsLoading,
    presetsLoading,
    updateConfig,
    updatePermission,
    activatePreset,
  } = useAgentSettings();

  const [tab, setTab] = useState(() => {
    const idx = TAB_KEYS.indexOf(initialTab);
    return idx === -1 ? 0 : idx;
  });
  const [selectedAgent, setSelectedAgent] = useState<AgentType>('orchestrator');
  const [editState, setEditState] = useState<Record<string, string>>({});

  // Allow external triggers (e.g. ReflectionStatus chip clicks while the
  // settings page is already mounted) to switch tabs without re-mounting.
  // Legitimate prop-driven state sync — refactoring to key-based remount
  // would re-fetch heavy data unnecessarily.
  useEffect(() => {
    const idx = TAB_KEYS.indexOf(initialTab);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (idx !== -1) setTab(idx);
  }, [initialTab]);

  const currentConfig = configs.find((c) => c.agent_type === selectedAgent);

  const handleFieldChange = useCallback(
    (field: string, value: string) => {
      setEditState((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const handleSave = useCallback(async () => {
    if (!currentConfig) return;
    await updateConfig(selectedAgent, {
      display_name: editState.display_name ?? currentConfig.display_name,
      personality: editState.personality ?? currentConfig.personality,
      avatar_emoji: editState.avatar_emoji ?? currentConfig.avatar_emoji,
      model_name: editState.model_name ?? currentConfig.model_name,
      temperature: parseFloat(editState.temperature ?? String(currentConfig.temperature)),
    });
    setEditState({});
  }, [currentConfig, editState, selectedAgent, updateConfig]);

  const getFieldValue = (field: keyof AgentConfig) => {
    if (field in editState) return editState[field];
    if (currentConfig) return String(currentConfig[field] ?? '');
    return AGENT_DEFAULTS[selectedAgent]?.[field as 'name'] ?? '';
  };

  return (
    <SettingsRoot>
      <Stack
        direction="row"
        alignItems="center"
        gap={1}
        sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}
      >
        <IconButton size="small" onClick={onBack}>
          <ArrowBackIcon sx={{ fontSize: 18 }} />
        </IconButton>
        <Typography variant="h6" sx={{ fontSize: '0.9375rem' }}>
          {t('agent.settings.title')}
        </Typography>
      </Stack>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}
      >
        <Tab label={t('agent.settings.agentConfig')} />
        <Tab label={t('agent.settings.permissions')} />
        <Tab label={t('agent.knowledge.title')} />
        <Tab label={t('agent.templates.title')} />
        <Tab label={t('agent.skills.title')} />
        <Tab label={t('agent.memory.title')} />
        <Tab label={t('agent.profile.title')} />
      </Tabs>

      <ScrollArea>
        {tab === 0 && (
          <Stack gap={2} sx={{ p: 2 }}>
            <Stack direction="row" gap={0.5} flexWrap="wrap">
              {AGENT_TYPES.map((at) => {
                const def = AGENT_DEFAULTS[at];
                const cfg = configs.find((c) => c.agent_type === at);
                return (
                  <Button
                    key={at}
                    size="small"
                    variant={selectedAgent === at ? 'contained' : 'outlined'}
                    onClick={() => {
                      setSelectedAgent(at);
                      setEditState({});
                    }}
                    sx={{ minWidth: 0, px: 1.5 }}
                  >
                    {cfg?.avatar_emoji ?? def.emoji} {cfg?.display_name ?? def.name}
                  </Button>
                );
              })}
            </Stack>

            {configsLoading ? (
              <Stack gap={1}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} variant="rounded" height={40} />
                ))}
              </Stack>
            ) : (
              <Card variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent sx={{ p: 2 }}>
                  <Stack gap={2}>
                    <Stack direction="row" gap={1}>
                      <TextField
                        size="small"
                        label={t('agent.settings.avatar')}
                        value={getFieldValue('avatar_emoji')}
                        onChange={(e) => handleFieldChange('avatar_emoji', e.target.value)}
                        sx={{ width: 80 }}
                      />
                      <TextField
                        size="small"
                        label={t('agent.settings.name')}
                        value={getFieldValue('display_name')}
                        onChange={(e) => handleFieldChange('display_name', e.target.value)}
                        sx={{ flex: 1 }}
                      />
                    </Stack>

                    <PersonalityPresets
                      agentType={selectedAgent}
                      onSelect={(text) => handleFieldChange('personality', text)}
                    />

                    <TextField
                      size="small"
                      label={t('agent.settings.personality')}
                      value={getFieldValue('personality')}
                      onChange={(e) => handleFieldChange('personality', e.target.value)}
                      multiline
                      minRows={3}
                      fullWidth
                    />

                    <Stack direction="row" gap={1}>
                      <TextField
                        size="small"
                        label={t('agent.settings.model')}
                        value={getFieldValue('model_name')}
                        onChange={(e) => handleFieldChange('model_name', e.target.value)}
                        sx={{ flex: 1 }}
                      />
                      <TextField
                        size="small"
                        label={t('agent.settings.temperature')}
                        type="number"
                        value={getFieldValue('temperature')}
                        onChange={(e) => handleFieldChange('temperature', e.target.value)}
                        slotProps={{ htmlInput: { min: 0, max: 2, step: 0.1 } }}
                        sx={{ width: 100 }}
                      />
                    </Stack>

                    <Button
                      variant="contained"
                      size="small"
                      onClick={handleSave}
                      disabled={Object.keys(editState).length === 0}
                      sx={{ alignSelf: 'flex-end' }}
                    >
                      {t('agent.settings.save')}
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            )}
          </Stack>
        )}

        {tab === 1 && (
          <Stack gap={2} sx={{ p: 2 }}>
            <PresetSelector
              presets={presets}
              activePresetName={activePresetName}
              loading={presetsLoading}
              onActivate={activatePreset}
            />
            <Divider />
            <PermissionEditor
              permissions={permissions}
              loading={permissionsLoading}
              onUpdate={updatePermission}
            />
          </Stack>
        )}

        {tab === 2 && <KnowledgeDocList />}
        {tab === 3 && <TemplateEditor />}
        {tab === 4 && <SkillList />}
        {tab === 5 && <MemoryEditor />}
        {tab === 6 && <UserProfileEditor />}
      </ScrollArea>
    </SettingsRoot>
  );
};

export default AgentSettingsPage;
