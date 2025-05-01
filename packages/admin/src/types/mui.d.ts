// Type declarations for Material UI submodules
declare module '@mui/material/Container' {
  import { ContainerProps } from '@mui/material';
  const Container: React.ComponentType<ContainerProps>;
  export default Container;
}

declare module '@mui/material/Breadcrumbs' {
  import { BreadcrumbsProps } from '@mui/material';
  const Breadcrumbs: React.ComponentType<BreadcrumbsProps>;
  export default Breadcrumbs;
}

declare module '@mui/material/Link' {
  import { LinkProps } from '@mui/material';
  const Link: React.ComponentType<LinkProps>;
  export default Link;
}

declare module '@mui/material/FormControlLabel' {
  import { FormControlLabelProps } from '@mui/material';
  const FormControlLabel: React.ComponentType<FormControlLabelProps>;
  export default FormControlLabel;
}

declare module '@mui/material/DialogContentText' {
  import { DialogContentTextProps } from '@mui/material';
  const DialogContentText: React.ComponentType<DialogContentTextProps>;
  export default DialogContentText;
}

declare module '@mui/material/AlertTitle' {
  import { AlertTitleProps } from '@mui/material';
  const AlertTitle: React.ComponentType<AlertTitleProps>;
  export default AlertTitle;
}

declare module '@mui/material/Slider' {
  import { SliderProps } from '@mui/material';
  const Slider: React.ComponentType<SliderProps>;
  export default Slider;
}

declare module '@mui/material/Divider' {
  import { DividerProps } from '@mui/material';
  const Divider: React.ComponentType<DividerProps>;
  export default Divider;
}

declare module '@mui/material/InputAdornment' {
  import { InputAdornmentProps } from '@mui/material';
  const InputAdornment: React.ComponentType<InputAdornmentProps>;
  export default InputAdornment;
}

declare module '@mui/material/styles' {
  export interface Theme {
    palette: {
      primary: {
        main: string;
        light?: string;
        dark?: string;
      };
      secondary: {
        main: string;
        light?: string;
        dark?: string;
      };
      error: {
        main: string;
        light?: string;
        dark?: string;
      };
      warning: {
        main: string;
        light?: string;
        dark?: string;
      };
      info: {
        main: string;
        light?: string;
        dark?: string;
      };
      success: {
        main: string;
        light?: string;
        dark?: string;
      };
      text: {
        primary: string;
        secondary: string;
        disabled: string;
      };
      background: {
        paper: string;
        default: string;
      };
      action: {
        active: string;
        hover: string;
        selected: string;
        disabled: string;
        disabledBackground: string;
      };
      [key: string]: any;
    };
    spacing: (factor: number) => number | string;
    breakpoints: {
      up: (key: string | number) => string;
      down: (key: string | number) => string;
      between: (start: string | number, end: string | number) => string;
      only: (key: string) => string;
      values: {
        xs: number;
        sm: number;
        md: number;
        lg: number;
        xl: number;
      };
    };
    typography: {
      fontFamily: string;
      fontSize: number;
      fontWeightLight: number;
      fontWeightRegular: number;
      fontWeightMedium: number;
      fontWeightBold: number;
      h1: any;
      h2: any;
      h3: any;
      h4: any;
      h5: any;
      h6: any;
      subtitle1: any;
      subtitle2: any;
      body1: any;
      body2: any;
      button: any;
      caption: any;
      overline: any;
    };
    shape: {
      borderRadius: number;
    };
    transitions: {
      easing: {
        easeInOut: string;
        easeOut: string;
        easeIn: string;
        sharp: string;
      };
      duration: {
        shortest: number;
        shorter: number;
        short: number;
        standard: number;
        complex: number;
        enteringScreen: number;
        leavingScreen: number;
      };
    };
    zIndex: {
      mobileStepper: number;
      speedDial: number;
      appBar: number;
      drawer: number;
      modal: number;
      snackbar: number;
      tooltip: number;
    };
    [key: string]: any;
  }

  export function useTheme(): Theme;
  export function alpha(color: string | undefined, opacity: number): string;
}

declare module '@mui/material/FormHelperText' {
  import { FormHelperTextProps } from '@mui/material';
  const FormHelperText: React.ComponentType<FormHelperTextProps>;
  export default FormHelperText;
}

declare module '@mui/material/Radio' {
  import { RadioProps } from '@mui/material';
  const Radio: React.ComponentType<RadioProps>;
  export default Radio;
}

declare module '@mui/material/RadioGroup' {
  import { RadioGroupProps } from '@mui/material';
  const RadioGroup: React.ComponentType<RadioGroupProps>;
  export default RadioGroup;
}

declare module '@mui/material/Step' {
  import { StepProps } from '@mui/material';
  const Step: React.ComponentType<StepProps>;
  export default Step;
}

declare module '@mui/material/StepLabel' {
  import { StepLabelProps } from '@mui/material';
  const StepLabel: React.ComponentType<StepLabelProps>;
  export default StepLabel;
}

declare module '@mui/material/Stepper' {
  import { StepperProps } from '@mui/material';
  const Stepper: React.ComponentType<StepperProps>;
  export default Stepper;
}

declare module '@mui/material/FormGroup' {
  import { FormGroupProps } from '@mui/material';
  const FormGroup: React.ComponentType<FormGroupProps>;
  export default FormGroup;
}

declare module '@mui/material/Menu' {
  import { MenuProps } from '@mui/material';
  const Menu: React.ComponentType<MenuProps>;
  export default Menu;
}

declare module '@mui/material/ListItemIcon' {
  import { ListItemIconProps } from '@mui/material';
  const ListItemIcon: React.ComponentType<ListItemIconProps>;
  export default ListItemIcon;
}

declare module '@mui/material/ListItemText' {
  import { ListItemTextProps } from '@mui/material';
  const ListItemText: React.ComponentType<ListItemTextProps>;
  export default ListItemText;
}

declare module '@mui/system' {
  import { Theme } from '@mui/material/styles';

  export interface SxProps<T extends Theme = Theme> {
    [key: string]: any;
  }
}

// Add missing Material UI component declarations
declare module '@mui/material' {
  export interface FormControlLabelProps {
    control: React.ReactElement;
    label: React.ReactNode;
    checked?: boolean;
    disabled?: boolean;
    onChange?: (event: React.ChangeEvent<HTMLInputElement>, checked: boolean) => void;
    value?: string;
    [key: string]: any;
  }

  export interface DialogContentTextProps {
    children?: React.ReactNode;
    [key: string]: any;
  }

  export interface AlertTitleProps {
    children?: React.ReactNode;
    [key: string]: any;
  }

  export const FormControlLabel: React.ComponentType<FormControlLabelProps>;
  export const DialogContentText: React.ComponentType<DialogContentTextProps>;
  export const AlertTitle: React.ComponentType<AlertTitleProps>;
  export const Divider: React.ComponentType<any>;
  export const Checkbox: React.ComponentType<any>;
  export const Accordion: React.ComponentType<any>;
  export const AccordionSummary: React.ComponentType<any>;
  export const AccordionDetails: React.ComponentType<any>;
  export const LinearProgress: React.ComponentType<any>;

  // Additional components used in KnowledgeBaseDashboard.tsx
  export const Box: React.ComponentType<any>;
  export const Button: React.ComponentType<any>;
  export const Card: React.ComponentType<any>;
  export const CardContent: React.ComponentType<any>;
  export const CircularProgress: React.ComponentType<any>;
  export const Container: React.ComponentType<any>;
  export const Dialog: React.ComponentType<any>;
  export const DialogActions: React.ComponentType<any>;
  export const DialogContent: React.ComponentType<any>;
  export const DialogTitle: React.ComponentType<any>;
  export const Grid: React.ComponentType<any>;
  export const IconButton: React.ComponentType<any>;
  export const Paper: React.ComponentType<any>;
  export const Tab: React.ComponentType<any>;
  export const Tabs: React.ComponentType<any>;
  export const TextField: React.ComponentType<any>;
  export const Typography: React.ComponentType<any>;
  export const FormControl: React.ComponentType<any>;
  export const Switch: React.ComponentType<any>;
  export const Chip: React.ComponentType<any>;
  export const MenuItem: React.ComponentType<any>;
  export const Select: React.ComponentType<any>;
  export const InputLabel: React.ComponentType<any>;
  export const Tooltip: React.ComponentType<any>;
  export const Alert: React.ComponentType<any>;

  // Add interfaces for the new components
  export interface SliderProps {
    value?: number | number[];
    defaultValue?: number | number[];
    min?: number;
    max?: number;
    step?: number | null;
    marks?: boolean | { value: number; label?: React.ReactNode }[];
    valueLabelDisplay?: 'auto' | 'on' | 'off';
    onChange?: (event: React.ChangeEvent<{}>, value: number | number[]) => void;
    [key: string]: any;
  }

  export interface DividerProps {
    absolute?: boolean;
    children?: React.ReactNode;
    light?: boolean;
    orientation?: 'horizontal' | 'vertical';
    variant?: 'fullWidth' | 'inset' | 'middle';
    [key: string]: any;
  }

  export interface InputAdornmentProps {
    children?: React.ReactNode;
    position: 'start' | 'end';
    disablePointerEvents?: boolean;
    variant?: 'standard' | 'outlined' | 'filled';
    [key: string]: any;
  }

  export const Slider: React.ComponentType<SliderProps>;
  export const InputAdornment: React.ComponentType<InputAdornmentProps>;

  // Add interfaces for the new components
  export interface FormHelperTextProps {
    children?: React.ReactNode;
    error?: boolean;
    disabled?: boolean;
    [key: string]: any;
  }

  export interface RadioProps {
    checked?: boolean;
    color?: 'primary' | 'secondary' | 'default' | 'error' | 'info' | 'success' | 'warning';
    disabled?: boolean;
    onChange?: (event: React.ChangeEvent<HTMLInputElement>, checked: boolean) => void;
    value?: any;
    [key: string]: any;
  }

  export interface RadioGroupProps {
    children?: React.ReactNode;
    defaultValue?: any;
    name?: string;
    onChange?: (event: React.ChangeEvent<HTMLInputElement>, value: string) => void;
    value?: any;
    [key: string]: any;
  }

  export interface StepProps {
    active?: boolean;
    children?: React.ReactNode;
    completed?: boolean;
    disabled?: boolean;
    [key: string]: any;
  }

  export interface StepLabelProps {
    children?: React.ReactNode;
    error?: boolean;
    icon?: React.ReactNode;
    optional?: React.ReactNode;
    [key: string]: any;
  }

  export interface StepperProps {
    activeStep?: number;
    alternativeLabel?: boolean;
    children?: React.ReactNode;
    nonLinear?: boolean;
    orientation?: 'horizontal' | 'vertical';
    [key: string]: any;
  }

  export const FormHelperText: React.ComponentType<FormHelperTextProps>;
  export const Radio: React.ComponentType<RadioProps>;
  export const RadioGroup: React.ComponentType<RadioGroupProps>;
  export const Step: React.ComponentType<StepProps>;
  export const StepLabel: React.ComponentType<StepLabelProps>;
  export const Stepper: React.ComponentType<StepperProps>;

  // Add interfaces for the new components
  export interface FormGroupProps {
    children?: React.ReactNode;
    row?: boolean;
    [key: string]: any;
  }

  export interface MenuProps {
    anchorEl?: null | Element | ((element: Element) => Element);
    children?: React.ReactNode;
    open?: boolean;
    onClose?: (event: {}, reason: 'backdropClick' | 'escapeKeyDown') => void;
    [key: string]: any;
  }

  export interface ListItemIconProps {
    children?: React.ReactNode;
    [key: string]: any;
  }

  export interface ListItemTextProps {
    children?: React.ReactNode;
    primary?: React.ReactNode;
    secondary?: React.ReactNode;
    [key: string]: any;
  }

  export const FormGroup: React.ComponentType<FormGroupProps>;
  export const Menu: React.ComponentType<MenuProps>;
  export const ListItemIcon: React.ComponentType<ListItemIconProps>;
  export const ListItemText: React.ComponentType<ListItemTextProps>;
}
