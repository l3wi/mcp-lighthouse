export const formatNumber = (number: number) => {
  // handle negative gracefully
  if (number < 0) {
    return `-$${Math.abs(number).toLocaleString("en-US", {
      maximumFractionDigits: 2,
    })}`;
  } else {
    return number.toLocaleString("en-US", {
      maximumFractionDigits: 2,
    });
  }
};

export const formatPercentage = (number: number) => {
  return number.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
};
