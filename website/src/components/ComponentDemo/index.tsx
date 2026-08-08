import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import type {ReactElement} from "react";

interface ComponentDemoProps {
  name: string;
  height?: number;
}

const ComponentDemo = ({name, height = 420}: ComponentDemoProps): ReactElement => {
  const {siteConfig} = useDocusaurusContext();
  const demoUrl =
    (siteConfig.customFields?.demoUrl as string | undefined) ?? "https://terreno-demo.netlify.app";
  const encodedName = encodeURIComponent(name);
  const embedSrc = `${demoUrl}/demo/${encodedName}?embed=1`;
  const playgroundHref = `${demoUrl}/demo/${encodedName}`;

  return (
    <div className="component-demo">
      <iframe
        className="component-demo__frame"
        height={height}
        loading="lazy"
        src={embedSrc}
        title={`${name} live demo`}
      />
      <div className="component-demo__footer">
        <span>Live preview from the Terreno component demo</span>
        <a href={playgroundHref} rel="noopener noreferrer" target="_blank">
          Open in playground ↗
        </a>
      </div>
    </div>
  );
};

export default ComponentDemo;
