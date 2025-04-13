// Barrel file for Material UI components
// This file re-exports components from Material UI to provide a consistent import pattern

// Export all components from the main package
export * from '@mui/material';

// Re-export useTheme from the styles package
export { useTheme } from '@mui/material/styles';

// Export the alpha function for color manipulation
export { alpha } from '@mui/material/styles';

// Import and re-export components that may not be properly exported from the main package
import Box from '@mui/system/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import Collapse from '@mui/material/Collapse';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';

// Re-export the individually imported components
export {
  Box,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Grid,
  Paper,
  Tab,
  Tabs,
  Typography,
  Chip,
  Button,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Collapse,
  TextField,
  Alert
};

// Re-export Theme type from @mui/material/styles
export type { Theme } from '@mui/material/styles';

// Re-export SxProps from @mui/system
export type { SxProps } from '@mui/system';
