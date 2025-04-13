// Type declarations for Material UI submodules
declare module '@mui/system/Box' {
  import { BoxProps } from '@mui/system';
  const Box: React.ComponentType<BoxProps>;
  export default Box;
}

declare module '@mui/material/Card' {
  import { CardProps } from '@mui/material';
  const Card: React.ComponentType<CardProps>;
  export default Card;
}

declare module '@mui/material/CardContent' {
  import { CardContentProps } from '@mui/material';
  const CardContent: React.ComponentType<CardContentProps>;
  export default CardContent;
}

declare module '@mui/material/CircularProgress' {
  import { CircularProgressProps } from '@mui/material';
  const CircularProgress: React.ComponentType<CircularProgressProps>;
  export default CircularProgress;
}

declare module '@mui/material/Divider' {
  import { DividerProps } from '@mui/material';
  const Divider: React.ComponentType<DividerProps>;
  export default Divider;
}

declare module '@mui/material/Grid' {
  import { GridProps } from '@mui/material';
  const Grid: React.ComponentType<GridProps>;
  export default Grid;
}

declare module '@mui/material/Paper' {
  import { PaperProps } from '@mui/material';
  const Paper: React.ComponentType<PaperProps>;
  export default Paper;
}

declare module '@mui/material/Tab' {
  import { TabProps } from '@mui/material';
  const Tab: React.ComponentType<TabProps>;
  export default Tab;
}

declare module '@mui/material/Tabs' {
  import { TabsProps } from '@mui/material';
  const Tabs: React.ComponentType<TabsProps>;
  export default Tabs;
}

declare module '@mui/material/Typography' {
  import { TypographyProps } from '@mui/material';
  const Typography: React.ComponentType<TypographyProps>;
  export default Typography;
}

declare module '@mui/material/Chip' {
  import { ChipProps } from '@mui/material';
  const Chip: React.ComponentType<ChipProps>;
  export default Chip;
}

declare module '@mui/material/Button' {
  import { ButtonProps } from '@mui/material';
  const Button: React.ComponentType<ButtonProps>;
  export default Button;
}

declare module '@mui/material/List' {
  import { ListProps } from '@mui/material';
  const List: React.ComponentType<ListProps>;
  export default List;
}

declare module '@mui/material/ListItem' {
  import { ListItemProps } from '@mui/material';
  const ListItem: React.ComponentType<ListItemProps>;
  export default ListItem;
}

declare module '@mui/material/ListItemText' {
  import { ListItemTextProps } from '@mui/material';
  const ListItemText: React.ComponentType<ListItemTextProps>;
  export default ListItemText;
}

declare module '@mui/material/IconButton' {
  import { IconButtonProps } from '@mui/material';
  const IconButton: React.ComponentType<IconButtonProps>;
  export default IconButton;
}

declare module '@mui/material/Collapse' {
  import { CollapseProps } from '@mui/material';
  const Collapse: React.ComponentType<CollapseProps>;
  export default Collapse;
}

declare module '@mui/material/TextField' {
  import { TextFieldProps } from '@mui/material';
  const TextField: React.ComponentType<TextFieldProps>;
  export default TextField;
}

declare module '@mui/material/Alert' {
  import { AlertProps } from '@mui/material';
  const Alert: React.ComponentType<AlertProps>;
  export default Alert;
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

declare module '@mui/system' {
  import { Theme } from '@mui/material/styles';

  export interface SxProps<T extends Theme = Theme> {
    [key: string]: any;
  }
  
  export interface BoxProps {
    children?: React.ReactNode;
    sx?: SxProps;
    [key: string]: any;
  }
}
