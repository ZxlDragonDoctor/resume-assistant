package com.zxl.resume.common;

import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import com.zxl.resume.common.exception.GlobalExceptionHandler;

@Configuration
@Import(GlobalExceptionHandler.class)
public class CommonConfig {
}
