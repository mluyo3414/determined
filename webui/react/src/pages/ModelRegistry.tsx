import { Button, Dropdown, Menu, Modal } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { FilterDropdownProps, SorterResult } from 'antd/lib/table/interface';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import Icon from 'components/Icon';
import Page from 'components/Page';
import ResponsiveTable from 'components/ResponsiveTable';
import tableCss from 'components/ResponsiveTable.module.scss';
import Section from 'components/Section';
import { archivedRenderer, getFullPaginationConfig, modelNameRenderer,
  relativeTimeRenderer, userRenderer } from 'components/Table';
import TableFilterDropdown from 'components/TableFilterDropdown';
import TableFilterSearch from 'components/TableFilterSearch';
import TagList from 'components/TagList';
import { useStore } from 'contexts/Store';
import handleError, { ErrorType } from 'ErrorHandler';
import { useFetchUsers } from 'hooks/useFetch';
import usePolling from 'hooks/usePolling';
import useSettings from 'hooks/useSettings';
import { archiveModel, deleteModel, getModels, patchModel, unarchiveModel } from 'services/api';
import { V1GetModelsRequestSortBy } from 'services/api-ts-sdk';
import { validateDetApiEnum } from 'services/utils';
import { ArchiveFilter, ModelItem } from 'types';
import { isBoolean, isEqual } from 'utils/data';
import { capitalize } from 'utils/string';

import css from './ModelRegistry.module.scss';
import settingsConfig, { Settings } from './ModelRegistry.settings';

const ModelRegistry: React.FC = () => {
  const { users, auth: { user } } = useStore();
  const [ models, setModels ] = useState<ModelItem[]>([]);
  const [ isLoading, setIsLoading ] = useState(true);
  const [ canceler ] = useState(new AbortController());
  const [ total, setTotal ] = useState(0);

  const {
    settings,
    updateSettings,
  } = useSettings<Settings>(settingsConfig);

  const fetchUsers = useFetchUsers(canceler);

  const fetchModels = useCallback(async () => {
    try {
      const response = await getModels({
        archived: settings.archived,
        description: settings.description,
        labels: settings.tags,
        limit: settings.tableLimit,
        name: settings.name,
        offset: settings.tableOffset,
        orderBy: settings.sortDesc ? 'ORDER_BY_DESC' : 'ORDER_BY_ASC',
        sortBy: validateDetApiEnum(V1GetModelsRequestSortBy, settings.sortKey),
        users: settings.users,
      }, { signal: canceler.signal });
      setTotal(response.pagination.total || 0);
      setModels(prev => {
        if (isEqual(prev, response.models)) return prev;
        return response.models;
      });
      setIsLoading(false);
    } catch(e) {
      handleError({ message: 'Unable to fetch models.', silent: true, type: ErrorType.Api });
      setIsLoading(false);
    }
  }, [ settings, canceler.signal ]);

  const fetchAll = useCallback(() => {
    fetchModels();
    fetchUsers();
  }, [ fetchModels, fetchUsers ]);

  usePolling(fetchAll);

  /*
   * Get new models based on changes to the
   * pagination and sorter.
   */
  useEffect(() => {
    fetchModels();
    setIsLoading(true);
  }, [
    fetchModels,
    settings,
  ]);

  const deleteCurrentModel = useCallback((model: ModelItem) => {
    deleteModel({ modelId: model.id });
  }, []);

  const switchArchived = useCallback((model: ModelItem) => {
    if (model.archived) {
      unarchiveModel({ modelId: model.id });
    } else {
      archiveModel({ modelId: model.id });
    }
    fetchModels();
    setIsLoading(true);
  }, [ fetchModels ]);

  const setModelTags = useCallback((modelId, tags) => {
    patchModel({ body: { id: modelId, labels: tags }, modelId });
    fetchModels();
    setIsLoading(true);
  }, [ fetchModels ]);

  const handleArchiveFilterApply = useCallback((archived: string[]) => {
    const archivedFilter = archived.length === 1
      ? archived[0] === ArchiveFilter.Archived : undefined;
    updateSettings({ archived: archivedFilter });
  }, [ updateSettings ]);

  const handleArchiveFilterReset = useCallback(() => {
    updateSettings({ archived: undefined });
  }, [ updateSettings ]);

  const archiveFilterDropdown = useCallback((filterProps: FilterDropdownProps) => (
    <TableFilterDropdown
      {...filterProps}
      values={isBoolean(settings.archived)
        ? [ settings.archived ? ArchiveFilter.Archived : ArchiveFilter.Unarchived ]
        : undefined}
      onFilter={handleArchiveFilterApply}
      onReset={handleArchiveFilterReset}
    />
  ), [ handleArchiveFilterApply, handleArchiveFilterReset, settings.archived ]);

  const handleUserFilterApply = useCallback((users: string[]) => {
    updateSettings({ users: users.length !== 0 ? users : undefined });
  }, [ updateSettings ]);

  const handleUserFilterReset = useCallback(() => {
    updateSettings({ users: undefined });
  }, [ updateSettings ]);

  const userFilterDropdown = useCallback((filterProps: FilterDropdownProps) => (
    <TableFilterDropdown
      {...filterProps}
      multiple
      searchable
      values={settings.users}
      onFilter={handleUserFilterApply}
      onReset={handleUserFilterReset} />
  ), [ handleUserFilterApply, handleUserFilterReset, settings.users ]);

  const tableSearchIcon = useCallback(() => <Icon name="search" size="tiny" />, []);

  const handleNameSearchApply = useCallback((newSearch: string) => {
    updateSettings({ name: newSearch || undefined });
  }, [ updateSettings ]);

  const handleNameSearchReset = useCallback(() => {
    updateSettings({ name: undefined });
  }, [ updateSettings ]);

  const nameFilterSearch = useCallback((filterProps: FilterDropdownProps) => (
    <TableFilterSearch
      {...filterProps}
      value={settings.name || ''}
      onReset={handleNameSearchReset}
      onSearch={handleNameSearchApply}
    />
  ), [ handleNameSearchApply, handleNameSearchReset, settings.name ]);

  const handleDescriptionSearchApply = useCallback((newSearch: string) => {
    updateSettings({ description: newSearch || undefined });
  }, [ updateSettings ]);

  const handleDescriptionSearchReset = useCallback(() => {
    updateSettings({ description: undefined });
  }, [ updateSettings ]);

  const descriptionFilterSearch = useCallback((filterProps: FilterDropdownProps) => (
    <TableFilterSearch
      {...filterProps}
      value={settings.description || ''}
      onReset={handleDescriptionSearchReset}
      onSearch={handleDescriptionSearchApply}
    />
  ), [ handleDescriptionSearchApply, handleDescriptionSearchReset, settings.description ]);

  const handleLabelFilterApply = useCallback((tags: string[]) => {
    updateSettings({ tags: tags.length !== 0 ? tags : undefined });
  }, [ updateSettings ]);

  const handleLabelFilterReset = useCallback(() => {
    updateSettings({ tags: undefined });
  }, [ updateSettings ]);

  const labelFilterDropdown = useCallback((filterProps: FilterDropdownProps) => (
    <TableFilterDropdown
      {...filterProps}
      multiple
      searchable
      values={settings.tags}
      onFilter={handleLabelFilterApply}
      onReset={handleLabelFilterReset}
    />
  ), [ handleLabelFilterApply, handleLabelFilterReset, settings.tags ]);

  const showConfirmDelete = useCallback((model: ModelItem) => {
    Modal.confirm({
      closable: true,
      content: `Are you sure you want to delete this model "${model.name}" and all 
      of its versions from the model registry?`,
      icon: null,
      maskClosable: true,
      okText: 'Delete Model',
      okType: 'danger',
      onOk: () => deleteCurrentModel(model),
      title: 'Confirm Delete',
    });
  }, [ deleteCurrentModel ]);

  const columns = useMemo(() => {
    const labelsRenderer = (value: string, record: ModelItem) => (
      <TagList
        compact
        tags={record.labels ?? []}
        onChange={(tags) => setModelTags(record.id, tags)}
      />
    );

    const overflowRenderer = (_:string, record: ModelItem) => {
      const isDeletable = user?.isAdmin;
      return (
        <Dropdown
          overlay={(
            <Menu>
              <Menu.Item
                key="switch-archived"
                onClick={() => switchArchived(record)}>
                {record.archived ? 'Unarchive' : 'Archive'}
              </Menu.Item>
              <Menu.Item
                danger
                disabled={!isDeletable}
                key="delete-model"
                onClick={() => showConfirmDelete(record)}>
                  Delete Model
              </Menu.Item>
            </Menu>
          )}>
          <Button className={css.overflow} type="text">
            <Icon name="overflow-vertical" size="tiny" />
          </Button>
        </Dropdown>
      );
    };

    const tableColumns: ColumnsType<ModelItem> = [
      {
        dataIndex: 'id',
        key: V1GetModelsRequestSortBy.CREATIONTIME,
        render: modelNameRenderer,
        sorter: true,
        title: 'ID',
        width: 60,
      },
      {
        dataIndex: 'name',
        filterDropdown: nameFilterSearch,
        filterIcon: tableSearchIcon,
        key: V1GetModelsRequestSortBy.NAME,
        onHeaderCell: () => settings.name ? { className: tableCss.headerFilterOn } : {},
        render: modelNameRenderer,
        sorter: true,
        title: 'Model name',
        width: 250,
      },
      {
        dataIndex: 'description',
        filterDropdown: descriptionFilterSearch,
        filterIcon: tableSearchIcon,
        key: V1GetModelsRequestSortBy.DESCRIPTION,
        onHeaderCell: () => settings.name ? { className: tableCss.headerFilterOn } : {},
        sorter: true,
        title: 'Description',
      },
      {
        dataIndex: 'numVersions',
        key: V1GetModelsRequestSortBy.NUMVERSIONS,
        sorter: true,
        title: 'Versions',
        width: 100,
      },
      {
        dataIndex: 'lastUpdatedTime',
        key: V1GetModelsRequestSortBy.LASTUPDATEDTIME,
        render: relativeTimeRenderer,
        sorter: true,
        title: 'Last updated',
        width: 150,
      },
      {
        dataIndex: 'labels',
        filterDropdown: labelFilterDropdown,
        onHeaderCell: () => settings.tags ? { className: tableCss.headerFilterOn } : {},
        render: labelsRenderer,
        title: 'Tags',
        width: 120,
      },
      {
        dataIndex: 'archived',
        filterDropdown: archiveFilterDropdown,
        filters: [
          { text: capitalize(ArchiveFilter.Archived), value: ArchiveFilter.Archived },
          { text: capitalize(ArchiveFilter.Unarchived), value: ArchiveFilter.Unarchived },
        ],
        key: 'archived',
        onHeaderCell: () => settings.archived != null ? { className: tableCss.headerFilterOn } : {},
        render: archivedRenderer,
        title: 'Archived',
        width: 120,
      },
      {
        dataIndex: 'username',
        filterDropdown: userFilterDropdown,
        filters: users.map(user => ({ text: user.username, value: user.username })),
        onHeaderCell: () => settings.archived != null ? { className: tableCss.headerFilterOn } : {},
        render: userRenderer,
        title: 'User',
        width: 100,
      },
      { fixed: 'right', render: overflowRenderer, title: '', width: 40 },
    ];

    return tableColumns.map(column => {
      column.sortOrder = null;
      if (column.key === settings.sortKey) {
        column.sortOrder = settings.sortDesc ? 'descend' : 'ascend';
      }
      return column;
    });
  }, [ nameFilterSearch,
    tableSearchIcon,
    descriptionFilterSearch,
    labelFilterDropdown,
    archiveFilterDropdown,
    userFilterDropdown,
    users,
    setModelTags,
    user?.isAdmin,
    switchArchived,
    showConfirmDelete,
    settings ]);

  const handleTableChange = useCallback((tablePagination, tableFilters, tableSorter) => {
    if (Array.isArray(tableSorter)) return;

    const { columnKey, order } = tableSorter as SorterResult<ModelItem>;
    if (!columnKey || !columns.find(column => column.key === columnKey)) return;

    const newSettings = {
      sortDesc: order === 'descend',
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      sortKey: columnKey as any,
      tableLimit: tablePagination.pageSize,
      tableOffset: (tablePagination.current - 1) * tablePagination.pageSize,
    };
    const shouldPush = settings.tableOffset !== newSettings.tableOffset;
    updateSettings(newSettings, shouldPush);
  }, [ columns, settings.tableOffset, updateSettings ]);

  useEffect(() => {
    return () => canceler.abort();
  }, [ canceler ]);

  return (
    <Page docTitle="Model Registry" id="models">
      <Section title="Model Registry">
        <ResponsiveTable
          columns={columns}
          dataSource={models}
          loading={isLoading}
          pagination={getFullPaginationConfig({
            limit: settings.tableLimit,
            offset: settings.tableOffset,
          }, total)}
          showSorterTooltip={false}
          size="small"
          onChange={handleTableChange} />
      </Section>
    </Page>
  );
};

export default ModelRegistry;
