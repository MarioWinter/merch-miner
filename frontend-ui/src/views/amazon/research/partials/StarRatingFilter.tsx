import { Stack, Typography, IconButton } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';

interface StarRatingFilterProps {
  value: number;
  onChange: (value: number) => void;
}

const STARS = [1, 2, 3, 4, 5];

const StarRatingFilter = ({ value, onChange }: StarRatingFilterProps) => {
  const handleClick = (star: number) => {
    onChange(value === star ? 0 : star);
  };

  return (
    <Stack spacing={0.5}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
        Min. Rating
      </Typography>
      <Stack direction="row" spacing={0}>
        {STARS.map((star) => (
          <IconButton
            key={star}
            onClick={() => handleClick(star)}
            size="small"
            aria-label={`Set minimum rating to ${star}`}
            sx={{ p: 0.25 }}
          >
            {star <= value ? (
              <StarIcon sx={{ fontSize: 24, color: 'warning.main' }} />
            ) : (
              <StarBorderIcon sx={{ fontSize: 24, color: 'text.disabled' }} />
            )}
          </IconButton>
        ))}
      </Stack>
      {value > 0 && (
        <Typography variant="caption" color="text.secondary">
          {value}+ stars
        </Typography>
      )}
    </Stack>
  );
};

export default StarRatingFilter;
