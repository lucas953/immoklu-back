import * as cookieParser from "cookie-parser";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("v1");
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: true
    })
  );
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'https://your-immoklu-frontend.vercel.app'
    ],
    credentials: true
  });

  const config = new DocumentBuilder()
    .setTitle("Immoklu API")
    .setDescription("Immoklu REST API")
    .setVersion("1.0.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("docs", app, document);

  await app.listen(process.env.PORT ? Number(process.env.PORT) : 4000);
}

void bootstrap();
