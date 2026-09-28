function LocationSelect({
  id,
  value,
  onChange,
  locations = [],
  required = false,
  disabled = false,
  placeholder = "เลือกสถานที่",
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={onChange}
      required={required}
      disabled={disabled}
    >
      <option value="">{placeholder}</option>
      {locations.map((location) => (
        <option key={location.id ?? location.location_name} value={location.location_name}>
          {location.location_code
            ? `${location.location_name} · ${location.location_code}`
            : location.location_name}
        </option>
      ))}
    </select>
  );
}

export default LocationSelect;
