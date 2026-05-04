import { useCallback } from 'react';
import {
  useGetConfigQuery,
  useUpdateConfigMutation,
  useGetPermissionsQuery,
  useUpdatePermissionsMutation,
  useListPresetsQuery,
  useActivatePresetMutation,
  useListTemplatesQuery,
  useListKnowledgeQuery,
} from '@/store/agentSlice';
import type { UpdateConfigBody, PermissionLevel } from '../types';

const useAgentSettings = () => {
  const { data: configs, isLoading: configsLoading } = useGetConfigQuery();
  const { data: permissions, isLoading: permissionsLoading } = useGetPermissionsQuery();
  const { data: presets, isLoading: presetsLoading } = useListPresetsQuery();
  const { data: templates, isLoading: templatesLoading } = useListTemplatesQuery();
  const { data: knowledge, isLoading: knowledgeLoading } = useListKnowledgeQuery();

  const [updateConfig] = useUpdateConfigMutation();
  const [updatePermissions] = useUpdatePermissionsMutation();
  const [activatePreset] = useActivatePresetMutation();

  const handleUpdateConfig = useCallback(
    async (agentType: string, body: UpdateConfigBody) => {
      await updateConfig({ agentType, body }).unwrap();
    },
    [updateConfig],
  );

  const handleUpdatePermission = useCallback(
    async (toolName: string, level: PermissionLevel) => {
      await updatePermissions({
        permissions: [{ tool_name: toolName, permission_level: level }],
      }).unwrap();
    },
    [updatePermissions],
  );

  const handleActivatePreset = useCallback(
    async (presetId: string) => {
      await activatePreset(presetId).unwrap();
    },
    [activatePreset],
  );

  return {
    configs: configs ?? [],
    permissions: permissions ?? [],
    presets: presets ?? [],
    templates: templates ?? [],
    knowledge: knowledge ?? [],
    configsLoading,
    permissionsLoading,
    presetsLoading,
    templatesLoading,
    knowledgeLoading,
    updateConfig: handleUpdateConfig,
    updatePermission: handleUpdatePermission,
    activatePreset: handleActivatePreset,
  };
};

export default useAgentSettings;
