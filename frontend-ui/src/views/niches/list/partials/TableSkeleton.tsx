import {
  Box,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import { styled } from '@mui/material/styles';

const ROW_COUNT = 5;

const HeaderCell = styled(TableCell)(({ theme }) => ({
  backgroundColor: 'transparent',
  borderBottom: `1px solid ${theme.vars.palette.divider}`,
  padding: '0 12px',
  height: 40,
}));

const BodyCell = styled(TableCell)(({ theme }) => ({
  borderBottom: `1px solid ${theme.vars.palette.divider}`,
  padding: '0 12px',
  height: 44,
}));

export const TableSkeleton = () => (
  <Table size="small" aria-busy aria-label="Loading niches">
    <TableHead>
      <TableRow>
        <HeaderCell padding="checkbox" sx={{ width: 44 }}>
          <Skeleton variant="rectangular" width={16} height={16} sx={{ borderRadius: 0.5 }} />
        </HeaderCell>
        <HeaderCell>
          <Skeleton variant="text" width={60} height={14} />
        </HeaderCell>
        <HeaderCell sx={{ width: 160 }}>
          <Skeleton variant="text" width={50} height={14} />
        </HeaderCell>
        <HeaderCell sx={{ width: 120 }}>
          <Skeleton variant="text" width={44} height={14} />
        </HeaderCell>
        <HeaderCell sx={{ width: 140 }}>
          <Skeleton variant="text" width={60} height={14} />
        </HeaderCell>
        <HeaderCell sx={{ width: 80 }}>
          <Skeleton variant="text" width={36} height={14} />
        </HeaderCell>
        <HeaderCell sx={{ width: 120 }}>
          <Skeleton variant="text" width={54} height={14} />
        </HeaderCell>
        <HeaderCell sx={{ width: 44 }} />
      </TableRow>
    </TableHead>

    <TableBody>
      {Array.from({ length: ROW_COUNT }).map((_, i) => (
        <TableRow key={i}>
          <BodyCell padding="checkbox">
            <Skeleton variant="rectangular" width={16} height={16} sx={{ borderRadius: 0.5 }} />
          </BodyCell>
          <BodyCell>
            <Skeleton variant="text" width={`${60 + (i % 3) * 20}%`} height={14} />
          </BodyCell>
          <BodyCell>
            <Skeleton variant="rounded" width={100} height={22} sx={{ borderRadius: '6px' }} />
          </BodyCell>
          <BodyCell>
            <Skeleton variant="rounded" width={72} height={22} sx={{ borderRadius: '6px' }} />
          </BodyCell>
          <BodyCell>
            <Skeleton variant="text" width={80} height={13} />
          </BodyCell>
          <BodyCell>
            <Skeleton variant="text" width={36} height={13} />
          </BodyCell>
          <BodyCell>
            <Skeleton variant="text" width={56} height={13} />
          </BodyCell>
          <BodyCell>
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Skeleton variant="circular" width={24} height={24} />
            </Box>
          </BodyCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);
