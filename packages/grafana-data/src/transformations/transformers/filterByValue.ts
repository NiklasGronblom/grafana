import { DataTransformerID } from './ids';
import { DataFrame /*FieldType,*/ } from '../../types/dataFrame';
import { MutableField } from '../../dataframe/MutableDataFrame';
import { DataTransformerInfo } from '../../types/transformations';
import { getFieldDisplayName } from '../../field/fieldState';
import { ArrayVector } from '../../vector/ArrayVector';
import { ValueFilterID, valueFiltersRegistry } from '../valueFilters';

export interface ValueFilter {
  fieldName: string | null; // Corresponding field name
  filterExpression: string | null; // The filter expression / value
  filterExpression2: string | null;
  filterArgs: Record<string, any>;
  filterType: ValueFilterID;
}

export interface FilterByValueTransformerOptions {
  valueFilters: ValueFilter[];
  type: string; // 'include' or 'exclude'
  match: string; // 'all' or 'any'
}

export const filterByValueTransformer: DataTransformerInfo<FilterByValueTransformerOptions> = {
  id: DataTransformerID.filterByValue,
  name: 'Filter by value',
  description: 'Filter the data points (rows) depending on the value of certain fields',
  defaultOptions: {
    valueFilters: [
      {
        fieldName: null,
        filterExpression: null,
        filterType: ValueFilterID.regex,
        filterExpression2: null,
        filterArgs: {},
      },
    ],
    type: 'include',
    match: 'all',
  },

  /**
   * Return a modified copy of the series.  If the transform is not or should not
   * be applied, just return the input series
   */
  transformer: (options: FilterByValueTransformerOptions) => {
    const includeRow = options.type === 'include';
    const matchAll = options.match === 'all';

    return (data: DataFrame[]) => {
      if (options.valueFilters.length === 0) {
        return data;
      }

      const processed: DataFrame[] = [];

      let includeThisRow = []; // All data points will be flagged for include (true) or exclude (false) in this variable

      for (let frame of data) {
        for (let filterIndex = 0; filterIndex < options.valueFilters.length; filterIndex++) {
          let filter = options.valueFilters[filterIndex];

          // Find the matching field for this filter
          let field = null;
          for (let f of frame.fields) {
            if (getFieldDisplayName(f) === filter.fieldName) {
              field = f;
              break;
            }
          }

          if (field === null) {
            continue; // No field found for for this filter in this frame, ignore
          }

          // This creates the filter instance we need (with the test function) we need to match the rows
          let filterInstance = valueFiltersRegistry.get(filter.filterType).getInstance({
            filterExpression: filter.filterExpression,
            filterExpression2: filter.filterExpression2,
            filterArgs: filter.filterArgs,
            fieldType: field.type,
          });

          if (!filterInstance.isValid) {
            continue;
          }

          if (matchAll) {
            // Run the test on each row
            for (let row = 0; row < frame.length; row++) {
              if (!filterInstance.test(field.values.get(row))) {
                includeThisRow[row] = !includeRow;
              } else if (filterIndex === 0) {
                includeThisRow[row] = includeRow;
              }
            }
          } else {
            // Run the test on each row
            for (let row = 0; row < frame.length; row++) {
              if (filterInstance.test(field.values.get(row))) {
                includeThisRow[row] = includeRow;
              } else if (filterIndex === 0) {
                includeThisRow[row] = !includeRow;
              }
            }
          }
        }

        // Create the skeleton of the new data, copy original field attributes
        let filteredFields: MutableField[] = [];
        for (let field of frame.fields) {
          filteredFields.push({
            ...field,
            values: new ArrayVector(),
            config: {
              ...field.config,
            },
          });
        }

        // Create a copy of the data with the included rows only
        let dataLength = 0;
        for (let row = 0; row < includeThisRow.length; row++) {
          if (includeThisRow[row]) {
            for (let j = 0; j < frame.fields.length; j++) {
              filteredFields[j].values.add(frame.fields[j].values.get(row));
            }
            dataLength++;
          }
        }

        processed.push({
          fields: filteredFields,
          length: dataLength,
        });
      }

      if (includeThisRow.length > 0) {
        return processed;
      } else {
        return data;
      }
    };
  },
};
