import {
  MenuToggle,
  Select,
  SelectList,
  SelectOption,
  Tooltip,
} from "@patternfly/react-core";
import { FilterIcon } from "@patternfly/react-icons";
import { useState } from "react";

type Option<T extends string> = { value: T; label: string; isDisabled?: boolean };

type FilterSelectProps<T extends string> = {
  id: string;
  /** Prefix shown on the toggle, e.g. "Status". */
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  isDisabled?: boolean;
  disabledReason?: string;
};

export function FilterSelect<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
  isDisabled,
  disabledReason,
}: FilterSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  const select = (
    <Select
      id={id}
      isOpen={open}
      selected={value}
      onSelect={(_, selected) => {
        onChange(selected as T);
        setOpen(false);
      }}
      onOpenChange={setOpen}
      toggle={(ref) => (
        <MenuToggle
          ref={ref}
          data-testid={id}
          icon={<FilterIcon />}
          isExpanded={open}
          isDisabled={isDisabled}
          onClick={() => setOpen(!open)}
        >
          {label}: {current?.label}
        </MenuToggle>
      )}
      shouldFocusToggleOnSelect
    >
      <SelectList>
        {options.map((o) => (
          <SelectOption key={o.value} value={o.value} isDisabled={o.isDisabled}>
            {o.label}
          </SelectOption>
        ))}
      </SelectList>
    </Select>
  );

  return isDisabled && disabledReason ? (
    <Tooltip content={disabledReason}>
      <span>{select}</span>
    </Tooltip>
  ) : (
    select
  );
}
