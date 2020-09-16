import React, { useMemo, useCallback } from 'react';
import { css } from 'emotion';
import {
  DataTransformerID,
  standardTransformers,
  TransformerRegistyItem,
  TransformerUIProps,
  getFieldDisplayName,
  Field,
  DataFrame,
  SelectableValue,
  FieldType,
} from '@grafana/data';
import { Select, Button, Input, RadioButtonGroup, stylesFactory } from '@grafana/ui';
import cloneDeep from 'lodash/cloneDeep';
import {
  FilterByValueTransformerOptions,
  ValueFilter,
} from '@grafana/data/src/transformations/transformers/filterByValue';

import { valueFiltersRegistry, ValueFilterID } from '@grafana/data/src/transformations/valueFilters';
import { getValueFilterArgsComponent } from './ValueFiltersComponents';

interface RowProps {
  fieldNameOptions: Array<SelectableValue<string>>;
  onDelete: () => void;
  onConfigChange: (config: ValueFilter) => void;
  config: ValueFilter;
  fieldType: FieldType;
}

const FilterSelectorRow: React.FC<RowProps> = props => {
  const { fieldNameOptions, onDelete, onConfigChange, config, fieldType } = props;

  // Find filter types that fit the chosen field type
  const filterTypeOptions = useMemo(() => {
    return valueFiltersRegistry
      .list()
      .filter(element => {
        if (!Array.isArray(element?.supportedFieldTypes)) {
          return true;
        }
        return element.supportedFieldTypes.includes(fieldType);
      })
      .map(item => ({
        value: item.id,
        label: item.name,
        description: item.description,
      }));
  }, [fieldType]);

  const filterInfo = valueFiltersRegistry.get(config.filterType);
  const filterInstance = filterInfo.getInstance({
    filterExpression: config.filterExpression,
    filterExpression2: config.filterExpression2,
    filterArgs: config.filterArgs,
    fieldType: fieldType,
  });
  const filterValid = filterInstance.isValid;

  const fieldNameInvalid = config.fieldName !== null && !fieldNameOptions.find(item => item.value === config.fieldName);
  const filterTypeInvalid =
    !fieldNameInvalid && filterInfo.supportedFieldTypes && !filterInfo.supportedFieldTypes.includes(fieldType);
  const filterExpressionInvalid =
    config.filterExpression !== '' &&
    ((filterInfo.placeholder2 !== undefined && config.filterExpression2 !== '') ||
      filterInfo.placeholder2 === undefined) &&
    !fieldNameInvalid &&
    !filterTypeInvalid &&
    !filterValid;

  console.log('>>', config, filterInfo, filterInstance);

  const onArgsChange = useCallback(
    (filterArgs: Record<string, any>) => {
      onConfigChange({ ...config, filterArgs });
    },
    [onConfigChange, config]
  );

  const filterArgsComponent = getValueFilterArgsComponent(config.filterType);

  return (
    <div className="gf-form-inline">
      <div className="gf-form gf-form-spacing">
        <div className="gf-form-label width-4">Field</div>
        <Select
          className="width-24"
          placeholder="Field Name"
          options={fieldNameOptions}
          value={config.fieldName}
          invalid={fieldNameInvalid}
          onChange={value => {
            onConfigChange({
              ...config,
              fieldName: value?.value ?? null,
            });
          }}
          isClearable
          menuPlacement="bottom"
        />
      </div>
      <div className="gf-form gf-form-spacing">
        <div className="gf-form-label width-8">Match</div>
        <Select
          invalid={filterTypeInvalid}
          className="width-8"
          placeholder="Select test"
          options={filterTypeOptions}
          value={config.filterType}
          onChange={value => {
            onConfigChange({ ...config, filterType: (value.value as ValueFilterID) ?? ValueFilterID.regex });
          }}
          menuPlacement="bottom"
        />
      </div>
      <div className="gf-form gf-form--grow gf-form-spacing ">
        {(filterArgsComponent &&
          filterArgsComponent({
            onArgsChange,
            filterArgs: config.filterArgs,
            invalidArgs: filterInstance.invalidArgs,
          })) ||
          (filterInfo.placeholder && (
            <Input
              className="flex-grow-1"
              invalid={filterInstance.expression1Invalid ?? filterExpressionInvalid}
              defaultValue={config.filterExpression || undefined}
              placeholder={filterInfo.placeholder}
              onBlur={event => {
                onConfigChange({ ...config, filterExpression: event.currentTarget.value });
              }}
            />
          ))}
      </div>
      {filterInfo.placeholder2 && (
        <div className="gf-form gf-form-spacing gf-form--grow">
          <Input
            className="flex-grow-1"
            invalid={filterInstance.expression2Invalid}
            defaultValue={config.filterExpression2 || undefined}
            placeholder={filterInfo.placeholder2}
            onBlur={event => {
              onConfigChange({ ...config, filterExpression2: event.currentTarget.value });
            }}
          />
        </div>
      )}
      <div className="gf-form">
        <Button icon="times" onClick={onDelete} style={{ height: '100%' }} size="sm" variant="secondary" />
      </div>
    </div>
  );
};

export const FilterByValueTransformerEditor: React.FC<TransformerUIProps<FilterByValueTransformerOptions>> = ({
  input,
  options,
  onChange,
}) => {
  const styles = getEditorStyles();
  const fieldsInfo = useMemo(() => getAllFieldInfoFromDataFrames(input), [input]);
  const fieldNameOptions = useMemo(
    () =>
      fieldsInfo
        .filter((item: Record<string, any>) => item.type !== FieldType.time)
        .map((item: Record<string, any>) => ({ label: item.name, value: item.name })),
    [fieldsInfo]
  );

  const onAddFilter = useCallback(() => {
    let valueFilters = cloneDeep(options.valueFilters);
    valueFilters.push({
      fieldName: null,
      filterExpression: null,
      filterExpression2: null,
      filterArgs: {},
      filterType: ValueFilterID.regex,
    });

    onChange({
      ...options,
      valueFilters,
    });
  }, [onChange, options]);

  const onDeleteFilter = useCallback(
    (index: number) => () => {
      let valueFilters = cloneDeep(options.valueFilters);
      valueFilters.splice(index, 1);
      onChange({
        ...options,
        valueFilters,
      });
    },
    [options, onChange]
  );

  const onConfigChange = useCallback(
    (index: number) => (config: ValueFilter) => {
      let valueFilters = cloneDeep(options.valueFilters);
      valueFilters[index] = config;
      onChange({
        ...options,
        valueFilters: valueFilters as ValueFilter[],
      });
    },
    [options, onChange]
  );

  return (
    <div>
      <div className="gf-form gf-form-inline">
        <div className="gf-form-label">Filter type</div>
        <RadioButtonGroup
          options={[
            { label: 'Include values', value: 'include' },
            { label: 'Exclude values', value: 'exclude' },
          ]}
          value={options.type}
          onChange={option => {
            onChange({ ...options, type: option || 'include' });
          }}
        />
      </div>
      <div className="gf-form gf-form-inline">
        <div className="gf-form-label gf-form--grow">Conditions</div>
        <RadioButtonGroup
          options={[
            { label: 'Match all', value: 'all' },
            { label: 'Match any', value: 'any' },
          ]}
          value={options.match}
          onChange={option => {
            onChange({ ...options, match: option || 'all' });
          }}
        />
      </div>
      <div className={styles.conditions}>
        {options.valueFilters.map((val, idx) => {
          const matchingField = getFieldByName(val.fieldName, input);
          return (
            <FilterSelectorRow
              onConfigChange={onConfigChange(idx)}
              onDelete={onDeleteFilter(idx)}
              fieldNameOptions={fieldNameOptions}
              config={val}
              fieldType={matchingField?.type || FieldType.other}
              key={idx}
            />
          );
        })}
        <div className="gf-form">
          <Button icon="plus" size="sm" onClick={onAddFilter} variant="secondary">
            Add condition
          </Button>
        </div>
      </div>
    </div>
  );
};

export const filterByValueTransformRegistryItem: TransformerRegistyItem<FilterByValueTransformerOptions> = {
  id: DataTransformerID.filterByValue,
  editor: FilterByValueTransformerEditor,
  transformation: standardTransformers.filterByValueTransformer,
  name: standardTransformers.filterByValueTransformer.name,
  description: standardTransformers.filterByValueTransformer.description,
};

const getEditorStyles = stylesFactory(() => ({
  conditions: css`
    padding-left: 16px;
  `,
}));

// Utils functions

// Returns an array of fields that match the fieldName
const getFieldsByName = (fieldName: string, data: DataFrame[]): Field[] => {
  if (!Array.isArray(data) || fieldName === null) {
    return [] as Field[];
  }

  let fieldList = [];

  for (let frame of data) {
    for (let field of frame.fields) {
      if (fieldName === getFieldDisplayName(field, frame, data)) {
        fieldList.push(field);
      }
    }
  }

  return fieldList;
};

// Returns the first field that matches the fieldName or null if none was found
const getFieldByName = (fieldName: string | null, data: DataFrame[]): Field | null => {
  if (fieldName === null) {
    return null;
  }
  let fieldList = getFieldsByName(fieldName, data);
  return fieldList.length > 0 ? fieldList[0] : null;
};

const getAllFieldInfoFromDataFrames = (input: DataFrame[]): Array<Record<string, any>> => {
  if (!Array.isArray(input)) {
    return [];
  }

  let fieldList = [];
  for (let frame of input) {
    for (let field of frame.fields) {
      fieldList.push({
        name: getFieldDisplayName(field, frame, input),
        type: field.type,
      });
    }
  }

  return fieldList;
};
